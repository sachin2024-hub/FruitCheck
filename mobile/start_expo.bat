@echo off
rem Double-click to start Expo for Expo Go through a Cloudflare tunnel (faster than --tunnel).
cd /d "%~dp0"
title FruitCheck Expo
node scripts\expo-start.js %*

rem Keep the window open if Expo stops or fails so the error stays visible.
pause
