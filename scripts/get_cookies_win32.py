import os
import glob
import sqlite3
import base64
import json
import ctypes
from ctypes import wintypes

# Windows API constants for file opening with full share permissions
GENERIC_READ = 0x80000000
FILE_SHARE_READ = 0x00000001
FILE_SHARE_WRITE = 0x00000002
FILE_SHARE_DELETE = 0x00000004
OPEN_EXISTING = 3
FILE_ATTRIBUTE_NORMAL = 0x80

class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

def decrypt_dpapi(cipher_text):
    buffer_in = ctypes.create_string_buffer(cipher_text, len(cipher_text))
    blob_in = DATA_BLOB(len(cipher_text), buffer_in)
    blob_out = DATA_BLOB()
    if ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
        data = ctypes.string_at(blob_out.pbData, blob_out.cbData)
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
        return data
    return None

def get_master_key(user_data_path):
    local_state_path = os.path.join(user_data_path, 'Local State')
    if not os.path.exists(local_state_path):
        return None
    with open(local_state_path, 'r', encoding='utf-8') as f:
        local_state = json.load(f)
    encrypted_key = base64.b64decode(local_state['os_crypt']['encrypted_key'])
    encrypted_key = encrypted_key[5:]
    return decrypt_dpapi(encrypted_key)

def decrypt_v10(master_key, cipher_text):
    try:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.backends import default_backend
        iv = cipher_text[3:15]
        payload = cipher_text[15:-16]
        tag = cipher_text[-16:]
        cipher = Cipher(algorithms.AES(master_key), modes.GCM(iv, tag), backend=default_backend())
        decryptor = cipher.decryptor()
        res = decryptor.update(payload) + decryptor.finalize()
        return res.decode('utf-8', errors='ignore')
    except Exception as e:
        return None

def copy_file_win32(src, dst):
    CreateFileW = ctypes.windll.kernel32.CreateFileW
    ReadFile = ctypes.windll.kernel32.ReadFile
    CloseHandle = ctypes.windll.kernel32.CloseHandle
    
    handle = CreateFileW(
        src,
        GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        None,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        None
    )
    if handle == -1 or handle == 0xFFFFFFFF:
        raise Exception(f"Failed to open source file handle: error code {ctypes.GetLastError()}")
    
    buf = bytearray()
    chunk_size = 65536
    buffer = ctypes.create_string_buffer(chunk_size)
    bytes_read = wintypes.DWORD()
    
    while True:
        success = ReadFile(handle, buffer, chunk_size, ctypes.byref(bytes_read), None)
        if not success or bytes_read.value == 0:
            break
        buf.extend(buffer.raw[:bytes_read.value])
        
    CloseHandle(handle)
    
    with open(dst, 'wb') as f:
        f.write(buf)

user_profile = os.environ['USERPROFILE']
chrome_path = os.path.join(user_profile, r'AppData\Local\Google\Chrome\User Data')
edge_path = os.path.join(user_profile, r'AppData\Local\Microsoft\Edge\User Data')

found_cookies = []

for base, name in [(chrome_path, 'Chrome'), (edge_path, 'Edge')]:
    if not os.path.exists(base):
        continue
    master_key = get_master_key(base)
    profiles = glob.glob(os.path.join(base, 'Default')) + glob.glob(os.path.join(base, 'Profile *'))
    for p in profiles:
        cookie_db = os.path.join(p, 'Network', 'Cookies')
        if not os.path.exists(cookie_db):
            cookie_db = os.path.join(p, 'Cookies')
        if os.path.exists(cookie_db):
            tmp_db = os.path.abspath(f'tmp_cookie_{name}_{os.path.basename(p)}.sqlite')
            try:
                copy_file_win32(cookie_db, tmp_db)
                conn = sqlite3.connect(tmp_db)
                cursor = conn.cursor()
                cursor.execute("SELECT host_key, name, value, encrypted_value, path, is_secure, is_httponly FROM cookies WHERE host_key LIKE '%suap%' OR host_key LIKE '%ifrn%'")
                rows = cursor.fetchall()
                conn.close()
                if os.path.exists(tmp_db):
                    os.remove(tmp_db)
                if rows:
                    print(f"Found {len(rows)} cookies in {name} profile {os.path.basename(p)}")
                    for r in rows:
                        host, cname, val, enc_val, path, is_secure, is_httponly = r
                        dec_val = val
                        if not dec_val and enc_val:
                            if enc_val.startswith(b'v10') or enc_val.startswith(b'v11'):
                                dec_val = decrypt_v10(master_key, enc_val)
                            else:
                                dec_val = decrypt_dpapi(enc_val)
                        if dec_val:
                            print(f"  [{name} - {os.path.basename(p)}] {host} -> {cname} = {dec_val[:10]}...")
                            found_cookies.append({
                                "domain": host,
                                "name": cname,
                                "value": dec_val,
                                "path": path,
                                "secure": bool(is_secure),
                                "httpOnly": bool(is_httponly)
                            })
            except Exception as e:
                print(f"Error reading {p}: {e}")

with open('extracted_suap_cookies.json', 'w') as f:
    json.dump(found_cookies, f, indent=2)

print(f"Extracted total {len(found_cookies)} cookies for SUAP/IFRN.")
