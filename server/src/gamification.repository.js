import { query } from './db.js';

const RANKS = [
  { slug: 'desafiante', name: 'Nível 10', min: 150000, color: '#E74C3C', emoji: '🔥' },
  { slug: 'mestre',     name: 'Nível 9',  min: 100000, color: '#9B59B6', emoji: '🏆' },
  { slug: 'grao-mestre',name: 'Nível 8',  min: 60000,  color: '#FFD700', emoji: '👑' },
  { slug: 'diamante',   name: 'Nível 7',  min: 30000,  color: '#67E8F9', emoji: '💠' },
  { slug: 'esmeralda',  name: 'Nível 6',  min: 15000,  color: '#50C878', emoji: '💚' },
  { slug: 'platina',    name: 'Nível 5',  min: 7500,   color: '#94A3B8', emoji: '💎' },
  { slug: 'ouro',       name: 'Nível 4',  min: 3500,   color: '#FFD700', emoji: '🥇' },
  { slug: 'prata',      name: 'Nível 3',  min: 1500,   color: '#C0C0C0', emoji: '🥈' },
  { slug: 'bronze',     name: 'Nível 2',  min: 500,    color: '#CD7F32', emoji: '🥉' },
  { slug: 'ferro',      name: 'Nível 1',  min: 0,      color: '#8B9094', emoji: '⛏️' },
];

export function getRankForXP(xp) {
  return RANKS.find(r => xp >= r.min) ?? RANKS[RANKS.length - 1];
}

export function getNextRank(slug) {
  const idx = RANKS.findIndex(r => r.slug === slug);
  return idx > 0 ? RANKS[idx - 1] : null;
}

function getTodayStr() { return new Date().toISOString().slice(0, 10); }
function getMondayStr() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}
function getResetDate(type) {
  if (type === 'daily') return getTodayStr();
  if (type === 'weekly') return getMondayStr();
  return '1970-01-01'; // sentinel for achievements (never resets)
}

const BADGE_MAP = {
  'wiki-read-daily':    'wiki-leitor',
  'wiki-read-weekly':   'wiki-estudioso',
  'wiki-read-50':       'wiki-sabio',
  'wiki-comment-daily': 'wiki-comentarista',
  'wiki-comment-10':    'wiki-colaborador',
  'training-watch':     'training-inicio',
  'training-complete':  'training-graduado',
  'training-expert':    'training-expert2',
};

export async function ensureUserXP(userId) {
  await query(
    `INSERT INTO user_xp (user_id, total_xp, rank_slug) VALUES ($1, 0, 'ferro')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

export async function awardXP(userId, action, referenceId = null) {
  try {
    await ensureUserXP(userId);

    const missionsRes = await query(`SELECT * FROM missions WHERE action = $1`, [action]);
    let totalXPAwarded = 0;
    const completedMissions = [];
    const newBadges = [];

    // Process all missions in parallel instead of sequentially
    await Promise.all(missionsRes.rows.map(async (mission) => {
      const resetDate = getResetDate(mission.type);

      const res = await query(
        `INSERT INTO user_missions (user_id, mission_slug, current_count, reset_date)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (user_id, mission_slug, reset_date) DO UPDATE
           SET current_count = CASE
             WHEN user_missions.xp_claimed = TRUE THEN user_missions.current_count
             ELSE user_missions.current_count + 1
           END
         RETURNING *`,
        [userId, mission.slug, resetDate]
      );
      const um = res.rows[0];

      if (um.current_count >= mission.target_count && !um.xp_claimed) {
        await query(
          `UPDATE user_missions SET completed_at = NOW(), xp_claimed = TRUE
           WHERE user_id = $1 AND mission_slug = $2 AND reset_date = $3`,
          [userId, mission.slug, resetDate]
        );
        totalXPAwarded += mission.xp_reward;
        completedMissions.push({ slug: mission.slug, name: mission.name, xp: mission.xp_reward });

        const badgeSlug = BADGE_MAP[mission.slug];
        if (badgeSlug) {
          const br = await query(
            `INSERT INTO user_badges (user_id, badge_slug) VALUES ($1, $2)
             ON CONFLICT (user_id, badge_slug) DO NOTHING RETURNING badge_slug`,
            [userId, badgeSlug]
          );
          if (br.rows[0]) newBadges.push(badgeSlug);
        }
      }
    }));

    if (totalXPAwarded > 0) {
      await query(
        `UPDATE user_xp SET total_xp = total_xp + $1, updated_at = NOW() WHERE user_id = $2`,
        [totalXPAwarded, userId]
      );
      await query(
        `INSERT INTO xp_events (user_id, action, xp_granted, reference_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, action, totalXPAwarded, referenceId]
      );
    }

    // Check rank change
    const xpRes = await query(`SELECT total_xp, rank_slug FROM user_xp WHERE user_id = $1`, [userId]);
    const { total_xp, rank_slug } = xpRes.rows[0];
    const newRank = getRankForXP(total_xp);

    if (newRank.slug !== rank_slug) {
      await query(`UPDATE user_xp SET rank_slug = $1 WHERE user_id = $2`, [newRank.slug, userId]);
      const rankBadgeRes = await query(
        `INSERT INTO user_badges (user_id, badge_slug) VALUES ($1, $2)
         ON CONFLICT (user_id, badge_slug) DO NOTHING RETURNING badge_slug`,
        [userId, `rank-${newRank.slug}`]
      );
      if (rankBadgeRes.rows[0]) newBadges.push(`rank-${newRank.slug}`);
    }

    return {
      xp_awarded: totalXPAwarded,
      rank_up: newRank.slug !== rank_slug ? newRank : null,
      completed_missions: completedMissions,
      new_badges: newBadges,
    };
  } catch (err) {
    console.error('[Gamification] awardXP error:', err.message);
    return null;
  }
}

export async function getUserGamificationProfile(userId) {
  await ensureUserXP(userId);

  const [xpRes, badgesRes] = await Promise.all([
    query(`SELECT total_xp, rank_slug FROM user_xp WHERE user_id = $1`, [userId]),
    query(
      `SELECT b.slug, b.name, b.description, b.icon_emoji, b.color, b.category, ub.earned_at
       FROM user_badges ub
       JOIN badges b ON b.slug = ub.badge_slug
       WHERE ub.user_id = $1
       ORDER BY b.sort_order`,
      [userId]
    ),
  ]);

  const { total_xp, rank_slug } = xpRes.rows[0];
  const rank = getRankForXP(total_xp);
  const nextRank = getNextRank(rank.slug);

  const progressPct = nextRank
    ? Math.min(100, Math.round(((total_xp - rank.min) / (nextRank.min - rank.min)) * 100))
    : 100;

  return {
    total_xp,
    rank_slug,
    rank,
    next_rank: nextRank,
    progress_pct: progressPct,
    xp_to_next: nextRank ? nextRank.min - total_xp : 0,
    badges: badgesRes.rows,
    ranks: RANKS.slice().reverse(), // ascending order for display
  };
}

export async function getUserMissions(userId) {
  await ensureUserXP(userId);

  const todayStr = getTodayStr();
  const mondayStr = getMondayStr();

  const { rows: missions } = await query(`SELECT * FROM missions ORDER BY type, sort_order`);
  const { rows: userMissions } = await query(
    `SELECT * FROM user_missions WHERE user_id = $1`,
    [userId]
  );

  const umMap = new Map(
    userMissions.map(um => [`${um.mission_slug}|${um.reset_date}`, um])
  );

  return missions.map(m => {
    const resetDate = getResetDate(m.type);
    const um = umMap.get(`${m.slug}|${resetDate}`);
    return {
      ...m,
      current_count: um?.current_count ?? 0,
      completed: !!(um?.completed_at),
      xp_claimed: !!(um?.xp_claimed),
      reset_date: resetDate,
    };
  });
}

export async function getGlobalRanking(limit = 50) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.photo_url, u.position,
            ux.total_xp, ux.rank_slug,
            ROW_NUMBER() OVER (ORDER BY ux.total_xp DESC) AS rank_position
     FROM user_xp ux
     JOIN users u ON u.id = ux.user_id
     WHERE u.status = 'active'
     ORDER BY ux.total_xp DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map(r => ({
    ...r,
    rank: getRankForXP(r.total_xp),
  }));
}

export async function getUserRankPosition(userId) {
  const res = await query(
    `SELECT rank_position FROM (
       SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_xp DESC) AS rank_position
       FROM user_xp
       JOIN users ON users.id = user_xp.user_id WHERE users.status = 'active'
     ) ranked WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0]?.rank_position ?? null;
}
