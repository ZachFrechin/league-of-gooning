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
			if (this.imageCache.size > 300) {
				const firstKey = this.imageCache.keys().next().value;
				this.imageCache.delete(firstKey);
			}
			return img;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Generate a FULL match image with player stats AND both teams
	 */
	static async generateFullMatchImage(participant, win, score, allyTeam, enemyTeam) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const width = 500;
		const playerHeight = 160;
		const teamRowHeight = 35;
		const teamHeight = teamRowHeight * 5 + 30;
		const height = playerHeight + teamHeight + 20;

		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// Preload ALL images in parallel
		const allUrls = [];
		// Player champion + items
		allUrls.push(`${DDRAGON_BASE}/img/champion/${participant.championName}.png`);
		for (let i = 0; i <= 6; i++) {
			const itemId = participant[`item${i}`];
			if (itemId && itemId > 0) allUrls.push(`${DDRAGON_BASE}/img/item/${itemId}.png`);
		}
		// Team champions only (skip items for speed)
		for (const p of [...allyTeam, ...enemyTeam]) {
			allUrls.push(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
		}

		// Load all at once
		await Promise.all(allUrls.map(url => this.loadImageCached(url)));

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
		if (champImg) ctx.drawImage(champImg, 15, 15, 70, 70);

		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 20px ${fontFamily}`;
		ctx.fillText(participant.championName || 'Unknown', 95, 35);

		ctx.font = `16px ${fontFamily}`;
		ctx.fillStyle = '#cccccc';
		ctx.fillText(`${participant.kills}/${participant.deaths}/${participant.assists}`, 95, 58);

		ctx.font = `13px ${fontFamily}`;
		ctx.fillStyle = '#888888';
		ctx.fillText(`Level ${participant.champLevel}`, 95, 78);

		ctx.font = `bold 14px ${fontFamily}`;
		ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
		ctx.fillText(win ? 'VICTORY' : 'DEFEAT', 380, 35);

		// Score bar
		const scoreNum = Number.isFinite(score) ? Math.round(score) : 0;
		ctx.fillStyle = '#222222';
		ctx.fillRect(15, 95, 470, 22);
		const scoreWidth = (scoreNum / 100) * 470;
		ctx.fillStyle = scoreNum >= 80 ? '#2ecc71' : scoreNum >= 60 ? '#f1c40f' : scoreNum >= 40 ? '#e67e22' : '#e74c3c';
		if (scoreWidth > 0) ctx.fillRect(15, 95, scoreWidth, 22);
		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 12px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`${scoreNum}/100`, 250, 110);
		ctx.textAlign = 'left';

		// Items
		const items = [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5];
		let itemX = 15;
		for (const itemId of items) {
			if (itemId && itemId > 0) {
				const itemImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
				if (itemImg) ctx.drawImage(itemImg, itemX, 125, 40, 40);
			} else {
				ctx.fillStyle = '#1a1a1a';
				ctx.fillRect(itemX, 125, 40, 40);
			}
			itemX += 45;
		}
		// Trinket
		if (participant.item6 && participant.item6 > 0) {
			const trinketImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${participant.item6}.png`);
			if (trinketImg) ctx.drawImage(trinketImg, itemX + 15, 125, 40, 40);
		}

		// === TEAMS SECTION ===
		const teamsY = playerHeight + 10;

		// Separator line
		ctx.strokeStyle = '#444444';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(15, teamsY);
		ctx.lineTo(width - 15, teamsY);
		ctx.stroke();

		// Team headers
		ctx.font = `bold 12px ${fontFamily}`;
		ctx.fillStyle = '#3498db';
		ctx.fillText('YOUR TEAM', 20, teamsY + 20);
		ctx.fillStyle = '#e74c3c';
		ctx.fillText('ENEMY TEAM', 270, teamsY + 20);

		// Draw teams side by side
		let allyY = teamsY + 35;
		let enemyY = teamsY + 35;

		for (let i = 0; i < 5; i++) {
			// Ally
			if (allyTeam[i]) {
				const p = allyTeam[i];
				const isMe = p.puuid === participant.puuid;

				if (isMe) {
					ctx.fillStyle = '#1a4a7c';
					ctx.fillRect(15, allyY - 2, 230, teamRowHeight - 5);
				}

				const champUrl = `${DDRAGON_BASE}/img/champion/${p.championName}.png`;
				const cImg = await this.loadImageCached(champUrl);
				if (cImg) ctx.drawImage(cImg, 20, allyY, 26, 26);

				ctx.fillStyle = '#ffffff';
				ctx.font = `12px ${fontFamily}`;
				ctx.fillText(`${p.kills}/${p.deaths}/${p.assists}`, 55, allyY + 18);
			}

			// Enemy
			if (enemyTeam[i]) {
				const p = enemyTeam[i];
				const champUrl = `${DDRAGON_BASE}/img/champion/${p.championName}.png`;
				const cImg = await this.loadImageCached(champUrl);
				if (cImg) ctx.drawImage(cImg, 270, enemyY, 26, 26);

				ctx.fillStyle = '#ffffff';
				ctx.font = `12px ${fontFamily}`;
				ctx.fillText(`${p.kills}/${p.deaths}/${p.assists}`, 305, enemyY + 18);
			}

			allyY += teamRowHeight;
			enemyY += teamRowHeight;
		}

		return canvas.toBuffer('image/png');
	}

	/**
	 * Simple player-only image (fallback)
	 */
	static async generateMatchImage(participant, win, score) {
		return this.generateFullMatchImage(participant, win, score, [], []);
	}
}

module.exports = MatchImageGenerator;
