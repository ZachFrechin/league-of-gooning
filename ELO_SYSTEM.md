# Système ELO & Leaderboard

## Vue d'ensemble

Le bot dispose maintenant d'un système ELO complet qui calcule un classement basé sur les performances en jeu.

## Comment fonctionne l'ELO?

### Points de départ
Tous les joueurs commencent à **1000 ELO**.

### Calcul du changement d'ELO

#### 1. Base Win/Loss
- **Victoire**: +25 points
- **Défaite**: -15 points

#### 2. Bonus de Performance (Score 0-100)
- Score 100 → +10 points
- Score 50 → 0 points
- Score 0 → -10 points
- Formule: `(score - 50) / 5`

#### 3. Bonus Kills
- +0.5 point par kill
- Maximum: +10 points (20+ kills)

#### 4. Bonus Vision
- Vision/min ≥ 2.0 → +3 points
- Vision/min ≥ 1.5 → +2 points
- Vision/min ≥ 1.0 → +1 point
- Vision/min < 1.0 → 0 points

#### 5. Multiplicateur de Rank (léger)
Le rang affecte légèrement le gain/perte d'ELO:
- Iron: ×1.15
- Bronze: ×1.10
- Silver: ×1.05
- Gold: ×1.00
- Platinum: ×0.95
- Emerald: ×0.93
- Diamond: ×0.90
- Master: ×0.88
- Grandmaster: ×0.85
- Challenger: ×0.82

**Effet**: Les joueurs de haut rang gagnent/perdent légèrement moins d'ELO (plus de stabilité).

### Limites
- Changement minimum: **±5 ELO**
- Changement maximum: **±50 ELO**

## Rangs ELO

| ELO | Rang | Emoji |
|-----|------|-------|
| 2000+ | Legendary | 👑 |
| 1800-1999 | Master | ⭐ |
| 1600-1799 | Diamond | 💎 |
| 1400-1599 | Gold | 🥇 |
| 1200-1399 | Silver | 🥈 |
| 1000-1199 | Bronze | 🥉 |
| 0-999 | Iron | 🔩 |

## Affichage dans les notifications

Chaque notification de match affiche maintenant:
```
DrMundo • Level 16 • 27m 5s
🥇 GOLD II - 45 LP
🥉 Bronze: 1150 ELO (+23)
```

- **Ligne 1**: Champion, niveau, durée
- **Ligne 2**: Rang League of Legends (optionnel)
- **Ligne 3**: Rang ELO du bot + ELO actuel + changement

## Commande Leaderboard

### Utilisation
```
/leaderboard
/leaderboard limit:15
```

### Affichage
```
🏆 Server ELO Leaderboard

🥇 PlayerOne#EUW
💎 Diamond • 1650 ELO
45 games • 62.2% WR • 68 avg score • 8.3 avg K

🥈 PlayerTwo#EUW
🥇 Gold • 1480 ELO
38 games • 55.3% WR • 61 avg score • 6.7 avg K

🥉 PlayerThree#EUW
🥈 Silver • 1320 ELO
52 games • 51.9% WR • 58 avg score • 5.4 avg K
```

### Statistiques affichées
- Position (🥇🥈🥉 ou numéro)
- Nom du joueur
- Rang ELO + ELO actuel
- Nombre de parties jouées
- Winrate (%)
- Score moyen (/100)
- Kills moyens par partie

### Options
- `limit`: Nombre de joueurs à afficher (5-25, défaut: 10)

## Exemples de calculs

### Exemple 1: Victoire avec bonne performance
```
Base: +25 (victoire)
Score (85): +7 (score bonus)
Kills (12): +6 (kill bonus)
Vision (2.1/min): +3 (vision bonus)
Rank (Gold): ×1.0

Total: (25 + 7 + 6 + 3) × 1.0 = +41 ELO
```

### Exemple 2: Défaite mais bien joué
```
Base: -15 (défaite)
Score (70): +4 (bon score malgré défaite)
Kills (8): +4 (kills)
Vision (1.8/min): +2 (bonne vision)
Rank (Platinum): ×0.95

Total: (-15 + 4 + 4 + 2) × 0.95 = -5 ELO (minimum appliqué)
```

### Exemple 3: Victoire mais mauvaise performance
```
Base: +25 (victoire)
Score (35): -3 (mauvais score)
Kills (2): +1 (peu de kills)
Vision (0.5/min): +0 (vision faible)
Rank (Silver): ×1.05

Total: (25 - 3 + 1 + 0) × 1.05 = +24 ELO
```

## Base de données

### Table `player_elo`
```sql
guild_id TEXT         -- ID du serveur Discord
puuid TEXT            -- ID unique du joueur
elo INTEGER           -- ELO actuel
matches_played INT    -- Nombre de parties
wins INTEGER          -- Victoires
losses INTEGER        -- Défaites
total_kills INTEGER   -- Total des kills
total_score INTEGER   -- Total des scores
updated_at DATETIME   -- Dernière mise à jour
```

## Avantages du système

1. **Équilibré**: Prend en compte plusieurs facteurs
2. **Pas trop punitif**: Les défaites ne font pas perdre beaucoup d'ELO si tu joues bien
3. **Récompense la performance**: Un bon score en défaite limite les pertes
4. **Importance de la vision**: Encourage le jeu d'équipe
5. **Adaptation au rang**: Les hauts rangs ont plus de stabilité
6. **Compétitif**: Crée une émulation entre joueurs du serveur

## Commandes disponibles

```
/leaderboard           - Affiche le top 10
/leaderboard limit:15  - Affiche le top 15
/list                  - Liste les comptes trackés
```

## Notes importantes

- L'ELO est **par serveur Discord** (pas global)
- Seules les parties **trackées** comptent
- L'ELO commence à 1000 pour tous
- Le système est indépendant du rang League of Legends
- Les ARAM et modes normaux comptent aussi (mais avec le même calcul)

## Déploiement

Sur ton VPS:
```bash
docker-compose down
docker-compose build
docker-compose up -d
docker-compose logs -f
```

Le système ELO se met automatiquement en place!
