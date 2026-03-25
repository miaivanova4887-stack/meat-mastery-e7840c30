

## Update Yoga Pose Names in content_blocks

Remove Sanskrit parenthetical names from 14 rows in `content_blocks` (7 poses × 2 locales).

### Data Updates

Using the insert tool, run 14 UPDATE statements against `content_blocks` where `page='exercise'` and `section='yoga_flow'`:

| key | locale | new value |
|-----|--------|-----------|
| pose_1_name | en | Child's Pose |
| pose_1_name | fr | Posture de l'Enfant |
| pose_2_name | en | Cat-Cow |
| pose_2_name | fr | Chat-Vache |
| pose_3_name | en | Downward Facing Dog |
| pose_3_name | fr | Chien Tête en Bas |
| pose_4_name | en | Low Lunge |
| pose_4_name | fr | Fente Basse |
| pose_5_name | en | Seated Forward Fold |
| pose_5_name | fr | Pince Assise |
| pose_6_name | en | Supine Twist |
| pose_6_name | fr | Torsion Allongée |
| pose_7_name | en | Corpse Pose |
| pose_7_name | fr | Posture du Cadavre |

No code or schema changes required.

