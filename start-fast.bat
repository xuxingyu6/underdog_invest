@echo off
title Fast Dev Server
echo Starting the fast development server...

:: Set the environment variable to disable lovable-tagger
set DISABLE_LOVABLE_TAGGER=true

:: Run the vite dev server
npm run dev

:: Keep the window open after the server stops
pause
