const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');

class MatchImageGenerator {
	static cachedVersion = null;
	static versionCacheTime = 0;
	static imageCache = new Map();

	static async getLatestVersion() {
		if (this.cachedVersion && Date.now() - this.versionCacheTime < 3600000) {
			return this.cachedVersion;
		}
		try {
			const response = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json', { timeout: 3000 });
			this.cachedVersion = response.data[0];
			this.versionCacheTime = Date.now();
			return this.cachedVersion;
		} catch (error) {
			return '15.1.1';
		}
	}

	static async loadImageCached(url) {
		if (this.imageCache.has(url)) {
			return this.imageCache.get(url);
		}
		try {
			const img = await loadImage(url);
			this.imageCache.set(url, img);
			if (this.imageCache.size > 500) {
				const firstKey = this.imageCache.keys().next().value;
				this.imageCache.delete(firstKey);
			}
			return img;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Generate a FULL match image with player stats AND both teams with items
	 */
	static async generateFullMatchImage(participant, win, score, allyTeam, enemyTeam, timelineData = null) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const width = 550;
		const playerHeight = 190;
		const teamRowHeight = 40;
		const teamHeight = teamRowHeight * 5 + 40;
		const graphHeight = timelineData ? 140 : 0;
		const height = playerHeight + teamHeight + graphHeight + (timelineData ? 25 : 15);

		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// === PRELOAD ALL IMAGES IN PARALLEL ===
		const allUrls = new Set();
		allUrls.add(`${DDRAGON_BASE}/img/champion/${participant.championName}.png`);
		for (let i = 0; i <= 6; i++) {
			const itemId = participant[`item${i}`];
			if (itemId && itemId > 0) allUrls.add(`${DDRAGON_BASE}/img/item/${itemId}.png`);
		}
		for (const p of [...allyTeam, ...enemyTeam]) {
			allUrls.add(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
			for (let i = 0; i <= 6; i++) {
				const itemId = p[`item${i}`];
				if (itemId && itemId > 0) allUrls.add(`${DDRAGON_BASE}/img/item/${itemId}.png`);
			}
		}
		await Promise.all([...allUrls].map(url => this.loadImageCached(url)));

		// === BACKGROUND ===
		const gradient = ctx.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, win ? '#1a3a5c' : '#5c1a1a');
		gradient.addColorStop(1, win ? '#0d1f30' : '#300d0d');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);

		// Border
		ctx.strokeStyle = win ? '#3498db' : '#e74c3c';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, width - 4, height - 4);

		// === PLAYER SECTION ===
		const champImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${participant.championName}.png`);
		if (champImg) ctx.drawImage(champImg, 15, 15, 75, 75);

		ctx.fillStyle = '#000000';
		ctx.beginPath();
		ctx.arc(82, 82, 16, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#f1c40f';
		ctx.beginPath();
		ctx.arc(82, 82, 14, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#000000';
		ctx.font = `bold 14px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`${participant.champLevel}`, 82, 87);
		ctx.textAlign = 'left';

		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 22px ${fontFamily}`;
		ctx.fillText(participant.championName || 'Unknown', 100, 38);

		ctx.font = `18px ${fontFamily}`;
		ctx.fillStyle = '#cccccc';
		ctx.fillText(`${participant.kills}/${participant.deaths}/${participant.assists}`, 100, 62);

		ctx.font = `bold 18px ${fontFamily}`;
		ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
		ctx.fillText(win ? 'VICTORY' : 'DEFEAT', 420, 38);

		const scoreNum = Number.isFinite(score) ? Math.round(score) : 0;
		ctx.fillStyle = '#222222';
		ctx.fillRect(15, 100, 520, 25);
		const sWidth = (scoreNum / 100) * 520;
		ctx.fillStyle = scoreNum >= 80 ? '#2ecc71' : scoreNum >= 60 ? '#f1c40f' : scoreNum >= 40 ? '#e67e22' : '#e74c3c';
		if (sWidth > 0) ctx.fillRect(15, 100, sWidth, 25);
		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 13px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`${scoreNum}/100 Performance`, 275, 117);
		ctx.textAlign = 'left';

		const items = [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5];
		let itemX = 15;
		for (const itemId of items) {
			if (itemId && itemId > 0) {
				const itemImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
				if (itemImg) ctx.drawImage(itemImg, itemX, 135, 42, 42);
			} else {
				ctx.fillStyle = '#1a1a1a';
				ctx.fillRect(itemX, 135, 42, 42);
			}
			itemX += 47;
		}
		if (participant.item6 && participant.item6 > 0) {
			const trinketImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${participant.item6}.png`);
			if (trinketImg) ctx.drawImage(trinketImg, itemX + 20, 135, 42, 42);
		}

		// === TEAMS SECTION ===
		const teamsY = playerHeight + 5;
		ctx.strokeStyle = '#444444';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(15, teamsY);
		ctx.lineTo(width - 15, teamsY);
		ctx.stroke();

		ctx.font = `bold 11px ${fontFamily}`;
		ctx.fillStyle = '#3498db';
		ctx.fillText('YOUR TEAM', 20, teamsY + 18);
		ctx.fillStyle = '#e74c3c';
		ctx.fillText('ENEMY TEAM', 290, teamsY + 18);

		let rowY = teamsY + 30;
		const miniItemSize = 18;

		for (let i = 0; i < 5; i++) {
			if (allyTeam[i]) {
				const p = allyTeam[i];
				if (p.puuid === participant.puuid) {
					ctx.fillStyle = '#1a4a7c';
					ctx.fillRect(15, rowY - 2, 255, teamRowHeight - 4);
				}
				const cImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
				if (cImg) ctx.drawImage(cImg, 20, rowY, 28, 28);
				ctx.fillStyle = '#ffffff';
				ctx.font = `11px ${fontFamily}`;
				ctx.fillText(`${p.kills}/${p.deaths}/${p.assists}`, 55, rowY + 18);
				let miniX = 110;
				for (let j = 0; j < 7; j++) {
					const itemId = p[`item${j}`];
					if (itemId && itemId > 0) {
						const iImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
						if (iImg) ctx.drawImage(iImg, miniX, rowY + 3, miniItemSize, miniItemSize);
					}
					miniX += miniItemSize + 2;
				}
			}
			if (enemyTeam[i]) {
				const p = enemyTeam[i];
				const cImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
				if (cImg) ctx.drawImage(cImg, 290, rowY, 28, 28);
				ctx.fillStyle = '#ffffff';
				ctx.font = `11px ${fontFamily}`;
				ctx.fillText(`${p.kills}/${p.deaths}/${p.assists}`, 325, rowY + 18);
				let miniX = 380;
				for (let j = 0; j < 7; j++) {
					const itemId = p[`item${j}`];
					if (itemId && itemId > 0) {
						const iImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
						if (iImg) ctx.drawImage(iImg, miniX, rowY + 3, miniItemSize, miniItemSize);
					}
					miniX += miniItemSize + 2;
				}
			}
			rowY += teamRowHeight;
		}

		// === GOLD GRAPH SECTION ===
		if (timelineData) {
			const graphY = teamsY + teamHeight + 10;
			this.drawGoldGraph(ctx, timelineData, participant.teamId, 15, graphY, width - 30, graphHeight, fontFamily);
		}

		return canvas.toBuffer('image/png');
	}

	static drawGoldGraph(ctx, timeline, playerTeamId, x, y, width, height, fontFamily) {
		const frames = timeline.info.frames;
		if (!frames || frames.length < 2) return;

		// Calculate gold advantage for player's team at each frame
		const advantageData = frames.map(frame => {
			let playerTeamGold = 0;
			let enemyTeamGold = 0;

			for (const participantId in frame.participantFrames) {
				const pFrame = frame.participantFrames[participantId];
				// Participant IDs 1-5 are usually team 100, 6-10 are team 200
				const teamId = parseInt(participantId) <= 5 ? 100 : 200;
				if (teamId === playerTeamId) playerTeamGold += pFrame.totalGold;
				else enemyTeamGold += pFrame.totalGold;
			}
			return playerTeamGold - enemyTeamGold;
		});

		const maxAdv = Math.max(...advantageData.map(Math.abs), 1000); // At least 1k scale
		const padding = 20;
		const drawW = width;
		const drawH = height - padding * 2;
		const centerY = y + padding + drawH / 2;

		// Background for graph
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
		this.drawRoundedRect(ctx, x, y, width, height, 10, true);

		// Grid and Label
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x, centerY);
		ctx.lineTo(x + width, centerY);
		ctx.stroke();

		ctx.fillStyle = '#9e9e9e';
		ctx.font = `bold 10px ${fontFamily}`;
		ctx.textAlign = 'left';
		ctx.fillText('GOLD ADVANTAGE', x + 10, y + 15);

		// Draw Advantage Curve
		const stepX = drawW / (advantageData.length - 1);
		ctx.beginPath();
		ctx.lineWidth = 2;

		for (let i = 0; i < advantageData.length; i++) {
			const val = advantageData[i];
			const posX = x + i * stepX;
			// Scale: val / maxAdv = offset / (drawH/2)
			const posY = centerY - (val / maxAdv) * (drawH / 2);

			if (i === 0) ctx.moveTo(posX, posY);
			else ctx.lineTo(posX, posY);
		}

		// Color the curve based on trend or result (here just blue/red gradient)
		const graphGradient = ctx.createLinearGradient(x, y + padding, x, y + height - padding);
		graphGradient.addColorStop(0, '#3498db'); // Ally advantage (top)
		graphGradient.addColorStop(0.5, '#ffffff');
		graphGradient.addColorStop(1, '#e74c3c'); // Enemy advantage (bottom)

		ctx.strokeStyle = graphGradient;
		ctx.stroke();

		// Fill area under/above curve
		ctx.lineTo(x + width, centerY);
		ctx.lineTo(x, centerY);
		ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
		ctx.fill();

		// Final advantage text
		const finalAdv = advantageData[advantageData.length - 1];
		ctx.textAlign = 'right';
		ctx.fillStyle = finalAdv >= 0 ? '#3498db' : '#e74c3c';
		ctx.font = `bold 12px ${fontFamily}`;
		const advText = finalAdv >= 0 ? `+${(finalAdv / 1000).toFixed(1)}k Ally` : `${(finalAdv / 1000).toFixed(1)}k Enemy`;
		ctx.fillText(advText, x + width - 10, y + 15);
	}

	/**
	 * Generate Mastery Image (Top 10)
	 */
	static async generateMasteryImage(summonerName, masteries) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const width = 800;
		const height = 450;
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// Background
		ctx.fillStyle = '#1e2328';
		ctx.fillRect(0, 0, width, height);

		// Header
		ctx.fillStyle = '#f0e6d2';
		ctx.font = `bold 28px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`TOP MASTERIES - ${summonerName.toUpperCase()}`, width / 2, 40);

		// Grid Layout
		const startX = 20;
		const startY = 70;
		const cardWidth = 140;
		const cardHeight = 170;
		const gapX = 15;
		const gapY = 20;

		const top10 = masteries.slice(0, 10);

		// Preload images
		const images = await Promise.all(top10.map(async (m) => {
			// Find champion name from ID (requires a mapping, or ddragon full data)
			// For simplicity assuming passed object has 'championName' or we fetch it.
			// Riot API masteries only give championId. We need to fetch champion data or use DDragon.
			// Ideally the caller passes enriched data. Let's assume 'championName' is present.
			if (!m.championName) return null;
			return this.loadImageCached(`${DDRAGON_BASE}/img/champion/${m.championName}.png`);
		}));

		ctx.textAlign = 'center';

		top10.forEach((m, i) => {
			const x = startX + (i % 5) * (cardWidth + gapX);
			const y = startY + Math.floor(i / 5) * (cardHeight + gapY);
			const img = images[i];

			// Card Background
			ctx.fillStyle = '#0f1419';
			ctx.fillRect(x, y, cardWidth, cardHeight);
			ctx.strokeStyle = '#c8aa6e'; // Gold border
			ctx.lineWidth = 1;
			ctx.strokeRect(x, y, cardWidth, cardHeight);

			// Champion Image
			if (img) {
				ctx.drawImage(img, x + 10, y + 10, 120, 120);
			}

			// Points
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 16px ${fontFamily}`;
			ctx.fillText(new Intl.NumberFormat('en-US', { notation: "compact" }).format(m.championPoints), x + cardWidth / 2, y + 150);

			// Level Badge (Overlay)
			ctx.fillStyle = '#0AC8B9'; // Hextech Blue
			ctx.beginPath();
			ctx.arc(x + cardWidth - 25, y + 30, 15, 0, Math.PI * 2);
			ctx.fill();

			ctx.fillStyle = '#000000';
			ctx.font = `bold 14px ${fontFamily}`;
			ctx.fillText(m.championLevel, x + cardWidth - 25, y + 35);
		});

		return canvas.toBuffer('image/png');
	}
	/**
 * Generate Match History Image (Last 10)
 */
	static async generateHistoryImage(summonerName, matches) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const width = 950; // WIDER
		const rowHeight = 85; // TALLER
		const headerHeight = 70;
		const height = headerHeight + (matches.length * rowHeight) + 20;

		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// Background
		ctx.fillStyle = '#1e2328';
		ctx.fillRect(0, 0, width, height);

		// Header
		ctx.fillStyle = '#f0e6d2';
		ctx.font = `bold 32px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`MATCH HISTORY - ${summonerName.toUpperCase()}`, width / 2, 45);

		// PRELOAD ALL IMAGES
		const champUrls = matches.map(m => `${DDRAGON_BASE}/img/champion/${m.championName}.png`);
		const itemUrls = new Set();
		matches.forEach(m => {
			if (m.items) {
				m.items.forEach(id => {
					if (id > 0) itemUrls.add(`${DDRAGON_BASE}/img/item/${id}.png`);
				});
			}
		});

		await Promise.all([
			...champUrls.map(url => this.loadImageCached(url)),
			...([...itemUrls].map(url => this.loadImageCached(url)))
		]);

		ctx.textAlign = 'left';

		for (let i = 0; i < matches.length; i++) {
			const m = matches[i];
			const y = headerHeight + (i * rowHeight);
			const x = 25;

			// Row Background (Win/Loss tint)
			ctx.fillStyle = m.win ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)';
			ctx.fillRect(x, y, width - 50, rowHeight - 8);

			// Sidebar color
			ctx.fillStyle = m.win ? '#2ECC71' : '#E74C3C';
			ctx.fillRect(x, y, 6, rowHeight - 8);

			// Champion Image
			const champImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${m.championName}.png`);
			if (champImg) {
				ctx.drawImage(champImg, x + 20, y + 10, 60, 60);
			}

			// Champion Level Badge
			ctx.fillStyle = '#1e2328';
			ctx.beginPath();
			ctx.arc(x + 72, y + 62, 12, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 12px ${fontFamily}`;
			ctx.textAlign = 'center';
			ctx.fillText(m.champLevel || '?', x + 72, y + 66);

			// KDA
			ctx.textAlign = 'left';
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 22px ${fontFamily}`;
			const kdaText = `${m.kills} / ${m.deaths} / ${m.assists}`;
			ctx.fillText(kdaText, x + 100, y + 38);

			// KDA Ratio
			ctx.fillStyle = '#bdc3c7';
			ctx.font = `14px ${fontFamily}`;
			const kdaRatio = m.deaths === 0 ? 'Perfect' : ((m.kills + m.assists) / m.deaths).toFixed(2);
			let kdaStr = `${kdaRatio} KDA`;

			// Performance Score (If exists)
			if (m.performanceScore !== null) {
				let scoreColor = '#bdc3c7'; // Grey
				if (m.performanceScore >= 90) scoreColor = '#ff3e3e'; // Legendary red
				else if (m.performanceScore >= 80) scoreColor = '#f1c40f'; // Gold
				else if (m.performanceScore >= 70) scoreColor = '#9b59b6'; // Purple
				else if (m.performanceScore >= 60) scoreColor = '#3498db'; // Blue

				ctx.fillText(kdaStr, x + 100, y + 60);
				const kdaWidth = ctx.measureText(kdaStr).width;

				ctx.fillStyle = scoreColor;
				ctx.font = `bold 14px ${fontFamily}`;
				ctx.fillText(` • Score: ${m.performanceScore}/100`, x + 100 + kdaWidth, y + 60);
			} else {
				ctx.fillText(kdaStr, x + 100, y + 60);
			}

			// Items
			if (m.items) {
				let itemX = x + 280;
				const itemSize = 34;
				for (let j = 0; j < 6; j++) {
					const itemId = m.items[j];
					if (itemId > 0) {
						const iImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
						if (iImg) ctx.drawImage(iImg, itemX, y + 23, itemSize, itemSize);
					} else {
						ctx.fillStyle = 'rgba(0,0,0,0.3)';
						ctx.fillRect(itemX, y + 23, itemSize, itemSize);
					}
					itemX += itemSize + 4;
				}
				// Trinket with a small gap
				const trinketId = m.items[6];
				if (trinketId > 0) {
					const tImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${trinketId}.png`);
					if (tImg) ctx.drawImage(tImg, itemX + 8, y + 23, itemSize, itemSize);
				}
			}

			// Mode & Date
			ctx.textAlign = 'right';
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 18px ${fontFamily}`;
			ctx.fillText(m.gameMode || 'UNKNOWN', width - 45, y + 35);

			ctx.fillStyle = '#95a5a6';
			ctx.font = `14px ${fontFamily}`;
			const date = new Date(m.gameEndTimestamp).toLocaleDateString('fr-FR');
			const duration = `${Math.floor(m.gameDuration / 60)}m ${m.gameDuration % 60}s`;
			ctx.fillText(`${date} • ${duration}`, width - 45, y + 58);
		}

		return canvas.toBuffer('image/png');
	}
	/**
	 * Generate Ranks Image
	 */
	static async generateRanksImage(summonerName, ranks) {
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const width = 1000;
		const height = 550;
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// Background
		ctx.fillStyle = '#1e2328';
		ctx.fillRect(0, 0, width, height);

		// Header
		ctx.fillStyle = '#f0e6d2';
		ctx.font = `bold 42px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`RANKS - ${summonerName.toUpperCase()}`, width / 2, 60);

		const queues = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'];
		const labels = ['SOLO / DUO', 'FLEX 5v5'];

		const cardWidth = 420;
		const cardHeight = 420;
		const startX = (width - (queues.length * cardWidth) - 40) / 2;
		const startY = 100;

		const TIER_COLORS = {
			'IRON': '#A19D94', 'BRONZE': '#CD7F32', 'SILVER': '#C0C0C0',
			'GOLD': '#D4AF37', 'PLATINUM': '#00CED1', 'EMERALD': '#2ECC71',
			'DIAMOND': '#3498DB', 'MASTER': '#9B59B6', 'GRANDMASTER': '#E74C3C',
			'CHALLENGER': '#F1C40F', 'UNRANKED': '#555555'
		};

		for (let i = 0; i < queues.length; i++) {
			const qType = queues[i];
			const x = startX + i * (cardWidth + 40);
			const y = startY;
			const rank = ranks.find(r => r.queueType === qType);
			const tier = rank ? rank.tier.toUpperCase() : 'UNRANKED';

			// Card Bg
			ctx.fillStyle = '#111519';
			this.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20, true);

			// Border
			ctx.strokeStyle = TIER_COLORS[tier] || '#333';
			ctx.lineWidth = 6;
			this.drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20, false, true);

			// Label
			ctx.fillStyle = '#9e9e9e';
			ctx.font = `bold 24px ${fontFamily}`;
			ctx.textAlign = 'center';
			ctx.fillText(labels[i], x + cardWidth / 2, y + 50);

			// Tier Image
			const tierName = tier.toLowerCase();
			const emblemUrl = tier === 'UNRANKED'
				? 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-unranked.png'
				: `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tierName}.png`;

			const maxEmblemSize = 280; // GIGANTIC
			try {
				const emblem = await this.loadImageCached(emblemUrl);
				if (emblem) {
					// Maintain aspect ratio to avoid squashing
					const ratio = emblem.width / emblem.height;
					let drawW = maxEmblemSize;
					let drawH = maxEmblemSize / ratio;

					if (drawH > maxEmblemSize) {
						drawH = maxEmblemSize;
						drawW = maxEmblemSize * ratio;
					}

					// Center emblem area (y+60 to y+300)
					const centerX = x + cardWidth / 2;
					const centerY = y + 180;
					ctx.drawImage(emblem, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
				}
			} catch (e) {
				ctx.fillStyle = TIER_COLORS[tier];
				ctx.beginPath();
				ctx.arc(x + cardWidth / 2, y + 170, 70, 0, Math.PI * 2);
				ctx.fill();
			}

			// Tier Text
			ctx.fillStyle = TIER_COLORS[tier] || '#fff';
			ctx.font = `bold 38px ${fontFamily}`;
			if (rank) {
				ctx.fillText(`${rank.tier} ${rank.rank}`, x + cardWidth / 2, y + 330);
				ctx.fillStyle = '#fff';
				ctx.font = `24px ${fontFamily}`;
				ctx.fillText(`${rank.leaguePoints} LP`, x + cardWidth / 2, y + 365);

				// Winrate
				const total = rank.wins + rank.losses;
				const wr = Math.round((rank.wins / total) * 100);
				ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c';
				ctx.font = `bold 20px ${fontFamily}`;
				ctx.fillText(`${rank.wins}W - ${rank.losses}L (${wr}%)`, x + cardWidth / 2, y + 395);
			} else {
				ctx.fillStyle = '#555';
				ctx.font = `bold 48px ${fontFamily}`;
				ctx.fillText('UNRANKED', x + cardWidth / 2, y + 330);
			}
		}

		return canvas.toBuffer('image/png');
	}
	/**
	 * Generate LoLdle Guess History Image
	 * @param {Array} attempts - Array of comparison objects from loldleService
	 */
	static async generateLoldleImage(attempts) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const rowHeight = 85;
		const headerHeight = 60;
		const width = 1100;
		// Limit to last 10 attempts to keep image size reasonable
		const displayAttempts = attempts.slice(-10);
		const height = headerHeight + (displayAttempts.length * rowHeight) + 20;

		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// Background - Dark Blue/Grey like LoLdle
		ctx.fillStyle = '#121212';
		ctx.fillRect(0, 0, width, height);

		// Headers
		const columns = ['Champion', 'Genre', 'Position', 'Espèce', 'Ressource', 'Portée', 'Région', 'Année'];
		const colWidths = [120, 110, 140, 140, 130, 110, 160, 90];
		let currentX = 20;

		ctx.textAlign = 'center';
		ctx.fillStyle = '#f0e6d2';
		ctx.font = `bold 18px ${fontFamily}`;

		columns.forEach((col, i) => {
			const w = colWidths[i];
			ctx.fillText(col.toUpperCase(), currentX + w / 2, 40);
			currentX += w + 10;
		});

		// Header underline
		ctx.strokeStyle = '#c8aa6e';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(20, 50);
		ctx.lineTo(width - 20, 50);
		ctx.stroke();

		// Preload Icon Images
		const icons = await Promise.all(displayAttempts.map(a => {
			const champId = a.champion.name
				.replace("'", "")
				.replace(" ", "")
				.replace("&", "")
				.replace(".", "");

			// Basic sanitization, but full mapping is better
			let id = champId;
			if (id === "NunuWillump") id = "Nunu";
			if (id === "Wukong") id = "MonkeyKing";
			if (id === "LeBlanc") id = "Leblanc";

			return this.loadImageCached(`${DDRAGON_BASE}/img/champion/${id}.png`);
		}));

		for (let i = 0; i < displayAttempts.length; i++) {
			const a = displayAttempts[i];
			const y = headerHeight + (i * rowHeight) + 10;
			let x = 20;

			// Helper to draw cell
			const drawCell = (text, status, w) => {
				let color = '#7e2217'; // Dark Red (INCORRECT)
				if (status === 'CORRECT') color = '#1a472a'; // Dark Green
				else if (status === 'PARTIAL' || status === 'HIGHER' || status === 'LOWER') color = '#8a4b08'; // Dark Orange/Brown

				// Draw rounded rect for cell
				ctx.fillStyle = color;
				// ctx.fillRect(x, y, w, 75);
				this.drawRoundedRect(ctx, x, y, w, 75, 5, true);

				// Border for "active" look
				ctx.strokeStyle = status === 'CORRECT' ? '#2ecc71' : status === 'INCORRECT' ? '#e74c3c' : '#f1c40f';
				ctx.lineWidth = 1;
				ctx.stroke();

				ctx.fillStyle = '#FFF';
				ctx.font = `bold 14px ${fontFamily}`;

				// Handle text wrapping/formatting
				const display = Array.isArray(text) ? text.join('\n') : text.toString();
				const lines = display.split('\n');
				const lineHeight = 16;
				const startY = y + 37 - ((lines.length - 1) * lineHeight) / 2;

				lines.forEach((line, idx) => {
					const textToDraw = line.length > 15 ? line.substring(0, 13) + '..' : line;
					ctx.fillText(textToDraw, x + w / 2, startY + idx * lineHeight);
				});

				// Arrow for year
				if (status === 'HIGHER') {
					ctx.font = `bold 20px ${fontFamily}`;
					ctx.fillText('↑', x + w / 2, y + 70);
				}
				if (status === 'LOWER') {
					ctx.font = `bold 20px ${fontFamily}`;
					ctx.fillText('↓', x + w / 2, y + 70);
				}

				x += w + 10;
			};

			// 1. Avatar Cell
			ctx.fillStyle = '#1e2328';
			this.drawRoundedRect(ctx, x, y, colWidths[0], 75, 5, true);
			ctx.strokeStyle = '#c8aa6e';
			ctx.stroke();

			if (icons[i]) {
				ctx.drawImage(icons[i], x + 22, y + 10, 55, 55);
			}
			x += colWidths[0] + 10;

			// 2. Data Cells
			drawCell(a.champion.gender, a.gender, colWidths[1]);
			drawCell(a.champion.positions, a.positions, colWidths[2]);
			drawCell(a.champion.species, a.species, colWidths[3]);
			drawCell(a.champion.resource, a.resource, colWidths[4]);
			drawCell(a.champion.rangeType, a.rangeType, colWidths[5]);
			drawCell(a.champion.regions, a.regions, colWidths[6]);
			drawCell(a.champion.year, a.year, colWidths[7]);
		}

		return canvas.toBuffer('image/png');
	}

	static drawRoundedRect(ctx, x, y, width, height, radius, fill = true, stroke = false) {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
		if (fill) ctx.fill();
		if (stroke) ctx.stroke();
	}
}

module.exports = MatchImageGenerator;
