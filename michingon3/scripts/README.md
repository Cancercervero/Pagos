# Service Account Key

Para ejecutar el script de seed, necesitas descargar tu Service Account Key de Firebase:

1. Ve a Firebase Console: https://console.firebase.google.com/project/michingon3-a77f8/settings/serviceaccounts/adminsdk
2. Click en "Generate new private key"
3. Guarda el archivo como `serviceAccountKey.json` en la raíz del proyecto
4. Este archivo YA está en .gitignore, no se subirá a GitHub

Una vez descargado, ejecuta:
```bash
npm run seed
```
