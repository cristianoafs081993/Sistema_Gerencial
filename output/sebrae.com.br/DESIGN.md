---
name: "Sebrae"
description: "Design tokens extracted from https://sebrae.com.br/"
colors:
  primary: "#FFFFFF"
  secondary: "#193AB8"
  surface: "#E7F79E"
  on-surface: "#000000"
typography:
  text-1:
    fontFamily: "Campuni"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.13
  text-2:
    fontFamily: "Figtree"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.17
  text-3:
    fontFamily: "Figtree"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.3
  text-4:
    fontFamily: "Figtree"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.31
  text-5:
    fontFamily: "Figtree"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.33
  text-6:
    fontFamily: "Figtree"
    fontSize: "21.92px"
    fontWeight: 600
    lineHeight: 1.2
  text-7:
    fontFamily: "Figtree"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.4
  text-8:
    fontFamily: "Figtree"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.4
  text-9:
    fontFamily: "Figtree"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.4
  text-10:
    fontFamily: "Figtree"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.33
  text-11:
    fontFamily: "Figtree"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.33
  text-12:
    fontFamily: "Figtree"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.56
  text-13:
    fontFamily: "Figtree"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.5
  text-14:
    fontFamily: "Figtree"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  text-15:
    fontFamily: "Figtree"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  text-16:
    fontFamily: "Lato"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.44
  text-17:
    fontFamily: "Figtree"
    fontSize: "14.4px"
    fontWeight: 400
    lineHeight: 2.64
  text-18:
    fontFamily: "Figtree"
    fontSize: "14.4px"
    fontWeight: 700
    lineHeight: 1
  text-19:
    fontFamily: "Figtree"
    fontSize: "14.4px"
    fontWeight: 600
  text-20:
    fontFamily: "Figtree"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.71
  text-21:
    fontFamily: "Figtree"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  text-22:
    fontFamily: "Figtree"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  text-23:
    fontFamily: "Figtree"
    fontSize: "13.6px"
    fontWeight: 400
  text-24:
    fontFamily: "Figtree"
    fontSize: "13.3333px"
    fontWeight: 400
  text-25:
    fontFamily: "Figtree"
    fontSize: "13.12px"
    fontWeight: 400
  text-26:
    fontFamily: "Figtree"
    fontSize: "13.008px"
    fontWeight: 400
  text-27:
    fontFamily: "Figtree"
    fontSize: "12.8px"
    fontWeight: 400
    lineHeight: 1.1
  text-28:
    fontFamily: "Figtree"
    fontSize: "12px"
    fontWeight: 400
  text-29:
    fontFamily: "Figtree"
    fontSize: "0px"
    fontWeight: 400
    lineHeight: Infinity
spacing:
  base: "8px"
  xs: "1px"
  sm: "4px"
  md: "5px"
  lg: "6px"
  xl: "7px"
  xxl: "8px"
  xxxl: "9.6px"
  xxxxl: "10px"
rounded:
  sm: "2px"
  md: "3px"
  lg: "4px"
  xl: "6px"
  full: "9999px"
components:
  button-observed:
    backgroundColor: "{colors.surface}"
    textColor: "#2A4FDA"
    rounded: "8px"
    padding: "8px 16px"
  input-observed:
    backgroundColor: "{colors.primary}"
    textColor: "#1B244B"
    rounded: "8px"
    padding: "10px 60px 10px 16px"
---

# Design System

## Overview
Design tokens extracted from sebrae.com.br. The YAML front matter contains machine-readable values observed by Dembrandt when available; the sections below summarize the extracted evidence without redesigning or correcting the source site.

## Colors
- **Primary** (#FFFFFF): Observed color token extracted from the site's palette, semantic CSS, or component styles.
- **Secondary** (#193AB8): Observed color token extracted from the site's palette, semantic CSS, or component styles.
- **Surface** (#E7F79E): Observed color token extracted from the site's palette, semantic CSS, or component styles.
- **On Surface** (#000000): Observed color token extracted from the site's palette, semantic CSS, or component styles.

## Typography
- **Text 1**: Campuni, 64px, bold
- **Text 2**: Figtree, 48px, bold
- **Text 3**: Figtree, 40px, bold
- **Text 4**: Figtree, 32px, bold
- **Text 5**: Figtree, 24px, bold
- **Text 6**: Figtree, 21.92px, semi-bold

## Layout
Observed spacing scale: 8px spacing scale.
- **Spacing tokens**: base 8px, xs 1px, sm 4px, md 5px, lg 6px, xl 7px, xxl 8px, xxxl 9.6px, xxxxl 10px
- **Responsive breakpoints**: 1600px, 1280px, 1279px, 1016px, 896px, 786px

## Elevation & Depth
Observed box-shadow styles: rgba(0, 94, 184, 0.14) 0px 18px 17px -4px; rgba(20, 46, 82, 0.2) 0px 2px 4px 0px; rgba(0, 0, 0, 0.2) 0px 4px 8px 0px

## Shapes
Observed rounded-corner tokens: sm 2px, md 3px, lg 4px, xl 6px, full 9999px.

## Components
- **Buttons**: Observed sample with radius 8px, background #E7F79E, text #2A4FDA, padding 8px 16px, border 2px solid rgb(231, 247, 158)
- **Inputs**: Observed sample with 2px solid border, 8px radius
