---
name: Job Lele
description: A monochrome job board based on Aditya Chawla's portfolio
colors:
  dark-canvas: "#0a0a0a"
  dark-surface: "#171717"
  dark-control: "#272727"
  dark-ink: "#fafafa"
  dark-muted: "#b6b6b6"
  light-canvas: "#f8f8f8"
  light-surface: "#fff"
  light-control: "#efefef"
  light-ink: "#171717"
  light-muted: "#595959"
  dialog-shadow: "rgb(0 0 0 / 28%)"
  dialog-backdrop: "rgb(0 0 0 / 68%)"
typography:
  promo-brand: {fontFamily: "Parkinsans, system-ui, sans-serif", fontSize: "1.625rem", fontWeight: 700}
  title: {fontFamily: "Parkinsans, system-ui, sans-serif", fontSize: "1.25rem", fontWeight: 700}
  small-title: {fontFamily: "Parkinsans, system-ui, sans-serif", fontSize: "1.125rem", fontWeight: 700}
  body: {fontFamily: "Parkinsans, system-ui, sans-serif", fontSize: "1rem", fontWeight: 400}
  company: {fontSize: ".9375rem"}
  caption: {fontSize: ".875rem"}
  label: {fontSize: ".8125rem"}
  meta: {fontSize: ".75rem"}
rounded:
  small: "6px"
  control: "7px"
  toggle: "8px"
  card: "12px"
  dialog: "14px"
components:
  job-card: {backgroundColor: "{colors.dark-surface}", textColor: "{colors.dark-ink}", rounded: "{rounded.card}", padding: "20px 22px"}
  job-card-light: {backgroundColor: "{colors.light-surface}", textColor: "{colors.light-ink}", rounded: "{rounded.card}", padding: "20px 22px"}
---

# Job Lele

## Overview

The dotted canvas and Parkinsans type follow the portfolio. Card fills distinguish surfaces without outlines. Use muted ink for metadata and reserve inverse fills for primary actions and selections.

## Layout

Put the jobs and filters in the main column and the GuptAI feature to the right. At 850px and below the two columns stack. The header contains the theme switch and X handle.

## Components

A job card can show the first two lines of a supplied description. Details and keywords open in a dialog with a scrollable body and a persistent Close button. The theme reveals from the top right in 700ms, with a direct swap for reduced motion.
