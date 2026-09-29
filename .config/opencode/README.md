# Figma MCP dans OpenCode

## Erreur d'enregistrement OAuth

OpenCode peut afficher `OAuth app with client id ... doesn’t exist` lors de
l'authentification au serveur MCP distant de Figma. Le contournement ci-dessous
utilise l'endpoint d'enregistrement OAuth de Figma pour obtenir un client, car
le flux standard peut échouer avec une application cliente non présente dans
sa allowlist. Cette allowlist et ce contournement ne sont pas une intégration
officielle documentée comme prise en charge. Le contournement peut être
considéré comme une usurpation d'identité de client (« impersonation ») :
utilisez-le uniquement si vous acceptez ce risque. **Si Figma refuse
l'enregistrement ou l'accès, arrêtez-vous. Ne cherchez pas à le contourner
avec un PAT.**

Références : [problème OpenCode](https://github.com/anomalyco/opencode/issues/988#issuecomment-4022520800),
[discussion Figma](https://forum.figma.com/report-a-problem-6/figma-s-approach-breaks-the-core-promise-of-mcp-52507),
[MCP distant dans OpenCode](https://opencode.ai/docs/mcp-servers/) et
[installation du serveur distant Figma](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/).

## Obtenir les paramètres du client

Envoyez la requête d'enregistrement suivante. Elle ne contient aucun secret :

```bash
curl --fail-with-body --silent --show-error \
  --request POST 'https://api.figma.com/v1/oauth/mcp/register' \
  --header 'Content-Type: application/json' \
  --data '{
    "client_name": "Claude Code (figma)",
    "redirect_uris": ["http://127.0.0.1:19876/mcp/oauth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none"
  }'
```

La réponse comprend `client_id` et `client_secret`. Traitez les deux comme des
secrets : ne les collez pas dans un fichier suivi par Git, une commande
conservée dans l'historique, un rapport ou une capture d'écran. N'utilisez pas
de PAT Figma.

## Configurer et relancer OpenCode

Dans un terminal zsh, saisissez les valeurs de la réponse à l'invite masquée.
La commande Python construit le JSON depuis l'environnement et sa sortie est
capturée dans une variable : les identifiants ne sont ni dans l'historique du
shell ni affichés. `OPENCODE_CONFIG_CONTENT` ne contient que la configuration
MCP temporaire, pas les valeurs littérales dans la commande :

```zsh
read -r -s 'FIGMA_MCP_CLIENT_ID?Client ID: '
print
read -r -s 'FIGMA_MCP_CLIENT_SECRET?Client secret: '
print
export FIGMA_MCP_CLIENT_ID FIGMA_MCP_CLIENT_SECRET
export OPENCODE_CONFIG_CONTENT="$(python3 -c 'import json, os; print(json.dumps({"mcp": {"figma": {"type": "remote", "url": "https://mcp.figma.com/mcp", "enabled": True, "oauth": {"clientId": os.environ["FIGMA_MCP_CLIENT_ID"], "clientSecret": os.environ["FIGMA_MCP_CLIENT_SECRET"]}}}}))')"
opencode mcp auth figma
```

Terminez l'autorisation dans le navigateur. Si Figma refuse l'accès, arrêtez-
vous. Après l'authentification, quittez complètement OpenCode, puis retirez
l'override et les identifiants de l'environnement avant de le relancer
normalement :

```zsh
unset OPENCODE_CONFIG_CONTENT FIGMA_MCP_CLIENT_ID FIGMA_MCP_CLIENT_SECRET
```

Vérifiez ensuite `opencode mcp list` : `figma` doit être `connected`, puis
invoquez un véritable outil Figma MCP depuis OpenCode et confirmez qu'il
retourne un résultat attendu. La liste seule ne valide pas l'échange avec le
serveur. Une erreur `405` liée à SSE juste après l'autorisation n'est pas une
preuve suffisante d'échec : elle a disparu après un redémarrage complet dans
le cas observé. Testez un outil réel après le redémarrage avant de conclure.

Lors d'une session observée, l'authentification CLI utilisait cet override
temporaire ; ensuite, `opencode mcp list` indiquait `connected` sans override.
Cela ne garantit pas que le refresh OAuth persistera à l'avenir. Si le flux
échoue ou si Figma refuse l'accès, arrêtez-vous.
