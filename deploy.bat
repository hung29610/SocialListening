@echo off
echo ========================================
echo   Deploying to GitHub...
echo ========================================
echo.

git add .
git commit -m "feat: update service catalog module"
git push origin main

if errorlevel 1 (
    echo.
    echo Syncing with remote...
    git pull origin main --rebase
    git push origin main
)

echo.
echo ========================================
echo   DEPLOYED SUCCESSFULLY!
echo ========================================
echo.
echo Backend:  https://social-listening-backend.onrender.com
echo Frontend: https://social-listening-azure.vercel.app
echo.
echo Auto-deployment will complete in 2-5 minutes.
echo.
pause
