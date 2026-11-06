# Winvero avec Docker

Prérequis : Docker et Compose. Sur cette machine, la commande disponible est `docker-compose` ; avec le plugin Compose, remplacer `docker-compose` par `docker compose`.

Copier `.env.example` vers `.env`, puis renseigner `TELEGRAM_BOT_TOKEN` avec le jeton fourni par BotFather. Le fichier `.env` est ignoré par Git.

```sh
docker-compose up --build -d
```

Ouvrir <http://localhost:8080>. L'interface et l'API partagent cette origine ; le serveur web transmet `/api/` à l'API. La base SQLite est conservée dans le volume nommé `winvero_data`.

Pour utiliser un autre port local, créer un fichier `.env` à la racine :

```dotenv
WINVERO_HTTP_PORT=8081
WINVERO_ORIGIN=http://localhost:8081
WINVERO_PUBLIC_URL=http://localhost:8081
```

Les trois valeurs doivent désigner la même adresse publique. Utiliser `localhost` dans le navigateur avec la configuration par défaut.

Le bot Telegram démarre maintenant avec l'interface et l'API. Pour trouver l'identifiant du chat administrateur, envoyer `/whoami` au bot après son premier démarrage, puis renseigner `TELEGRAM_ADMIN_CHAT_ID` dans `.env` et redémarrer les services :

```sh
docker-compose up -d
```

Sans jeton, le conteneur du bot s'arrête après quelques tentatives ; le site et l'API restent disponibles. Les notifications Telegram émises par l'API utilisent les mêmes variables et nécessitent aussi `TELEGRAM_ADMIN_CHAT_ID`. Les crédits de test sont activés par défaut ; définir `WINVERO_TEST_CREDITS_ENABLED=false` pour les désactiver.

Pour un déploiement derrière HTTPS, définir `WINVERO_ORIGIN` et `WINVERO_PUBLIC_URL` avec l'URL publique HTTPS et `WINVERO_NODE_ENV=production` afin d'activer le cookie de session `Secure`. Le proxy TLS doit transmettre les requêtes à `web:80`.

```sh
docker-compose ps
docker-compose logs -f api
docker-compose down
```

`docker-compose down` préserve le volume SQLite. La commande `docker-compose down -v` efface également ce volume.
