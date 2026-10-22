@echo off
cd /d "%~dp0"
if not exist node_modules call npm.cmd install
if not exist .next\BUILD_ID call npm.cmd run build
call npm.cmd start
pause
