---
description: Deploys functions to Firebase with latest src code
---

# Deploy Firebase Functions

This workflow syncs the `src` folder to `functions` and deploys to Firebase.

## Steps

// turbo
1. Clean old functions src:
```powershell
cd <ruta-del-repo>\michingon3
Remove-Item -Recurse -Force functions\src -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force functions\.next -ErrorAction SilentlyContinue
```

// turbo
2. Copy latest src to functions:
```powershell
Copy-Item -Recurse src functions\src
```

// turbo
3. Copy .env.local if exists:
```powershell
Copy-Item .env.local functions\.env.local -ErrorAction SilentlyContinue
```

// turbo
4. Build functions:
```powershell
cd functions ; npm run build
```

// turbo
5. Deploy functions to Firebase:
```powershell
cd <ruta-del-repo>\michingon3
firebase deploy --only functions
```

// turbo
6. Commit changes to Git:
```powershell
git add . ; git commit -m "deploy: sync functions with latest code" ; git push
```

## Verification

After deployment, verify the site works at: https://michingon3-a77f8.web.app

If you see a blank page:
1. Check function logs: `firebase functions:log --only nextjsFunc -n 30`
2. Look for errors related to missing modules or configuration issues
3. Ensure `functions/next.config.js` does NOT have `output: 'standalone'`
