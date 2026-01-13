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
	static async generateFullMatchImage(participant, win, score, allyTeam, enemyTeam) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		const width = 550;
		const playerHeight = 170;
		const teamRowHeight = 40;
		const teamHeight = teamRowHeight * 5 + 40;
		const height = playerHeight + teamHeight + 15;

		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// === PRELOAD ALL IMAGES IN PARALLEL ===
		const allUrls = new Set();

		// Player images
		allUrls.add(`${DDRAGON_BASE}/img/champion/${participant.championName}.png`);
		for (let i = 0; i <= 6; i++) {
			const itemId = participant[`item${i}`];
			if (itemId && itemId > 0) allUrls.add(`${DDRAGON_BASE}/img/item/${itemId}.png`);
		}

		// Team images (champions + items)
		for (const p of [...allyTeam, ...enemyTeam]) {
			allUrls.add(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
			for (let i = 0; i <= 6; i++) {
				const itemId = p[`item${i}`];
				if (itemId && itemId > 0) allUrls.add(`${DDRAGON_BASE}/img/item/${itemId}.png`);
			}
		}

		// Load all at once
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

		// Level badge (prominent)
		ctx.fillStyle = '#000000';
		ctx.beginPath();
		ctx.arc(75, 80, 16, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#f1c40f';
		ctx.beginPath();
		ctx.arc(75, 80, 14, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#000000';
		ctx.font = `bold 14px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`${participant.champLevel}`, 75, 85);
		ctx.textAlign = 'left';

		// Champion name
		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 22px ${fontFamily}`;
		ctx.fillText(participant.championName || 'Unknown', 100, 38);

		// KDA  
		ctx.font = `18px ${fontFamily}`;
		ctx.fillStyle = '#cccccc';
		ctx.fillText(`${participant.kills}/${participant.deaths}/${participant.assists}`, 100, 62);

		// Victory/Defeat badge
		ctx.font = `bold 18px ${fontFamily}`;
		ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
		ctx.fillText(win ? 'VICTORY' : 'DEFEAT', 420, 38);

		// Score bar
		const scoreNum = Number.isFinite(score) ? Math.round(score) : 0;
		ctx.fillStyle = '#222222';
		ctx.fillRect(15, 100, 520, 25);
		const scoreWidth = (scoreNum / 100) * 520;
		ctx.fillStyle = scoreNum >= 80 ? '#2ecc71' : scoreNum >= 60 ? '#f1c40f' : scoreNum >= 40 ? '#e67e22' : '#e74c3c';
		if (scoreWidth > 0) ctx.fillRect(15, 100, scoreWidth, 25);
		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 13px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`${scoreNum}/100 Performance`, 275, 117);
		ctx.textAlign = 'left';

		// Player Items
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
		// Trinket
		if (participant.item6 && participant.item6 > 0) {
			const trinketImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${participant.item6}.png`);
			if (trinketImg) ctx.drawImage(trinketImg, itemX + 20, 135, 42, 42);
		}

		// === TEAMS SECTION ===
		const teamsY = playerHeight + 5;

		// Separator
		ctx.strokeStyle = '#444444';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(15, teamsY);
		ctx.lineTo(width - 15, teamsY);
		ctx.stroke();

		// Team headers
		ctx.font = `bold 11px ${fontFamily}`;
		ctx.fillStyle = '#3498db';
		ctx.fillText('YOUR TEAM', 20, teamsY + 18);
		ctx.fillStyle = '#e74c3c';
		ctx.fillText('ENEMY TEAM', 290, teamsY + 18);

		// Draw teams side by side with mini items
		let rowY = teamsY + 30;
		const miniItemSize = 18;

		for (let i = 0; i < 5; i++) {
			// Ally player
			if (allyTeam[i]) {
				const p = allyTeam[i];
				const isMe = p.puuid === participant.puuid;

				if (isMe) {
					ctx.fillStyle = '#1a4a7c';
					ctx.fillRect(15, rowY - 2, 255, teamRowHeight - 4);
				}

				// Champion icon
				const cImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
				if (cImg) ctx.drawImage(cImg, 20, rowY, 28, 28);

				// KDA
				ctx.fillStyle = '#ffffff';
				ctx.font = `11px ${fontFamily}`;
				ctx.fillText(`${p.kills}/${p.deaths}/${p.assists}`, 55, rowY + 18);

				// Mini items (4 main items only for space)
				let miniX = 110;
				for (let j = 0; j < 4; j++) {
					const itemId = p[`item${j}`];
					if (itemId && itemId > 0) {
						const iImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
						if (iImg) ctx.drawImage(iImg, miniX, rowY + 3, miniItemSize, miniItemSize);
					}
					miniX += miniItemSize + 2;
				}
			}

			// Enemy player
			if (enemyTeam[i]) {
				const p = enemyTeam[i];

				// Champion icon
				const cImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${p.championName}.png`);
				if (cImg) ctx.drawImage(cImg, 290, rowY, 28, 28);

				// KDA
				ctx.fillStyle = '#ffffff';
				ctx.font = `11px ${fontFamily}`;
				ctx.fillText(`${p.kills}/${p.deaths}/${p.assists}`, 325, rowY + 18);

				// Mini items
				let miniX = 380;
				for (let j = 0; j < 4; j++) {
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

		return canvas.toBuffer('image/png');
	}
}

module.exports = MatchImageGenerator;
