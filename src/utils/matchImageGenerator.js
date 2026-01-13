const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');

class MatchImageGenerator {
	static cachedVersion = null;
	static versionCacheTime = 0;
	static imageCache = new Map(); // Cache loaded images

	/**
	 * Get the latest DDragon version dynamically
	 */
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
			console.error('Failed to fetch DDragon version:', error.message);
			return '15.1.1'; // Updated fallback
		}
	}

	/**
	 * Load image with caching
	 */
	static async loadImageCached(url) {
		if (this.imageCache.has(url)) {
			return this.imageCache.get(url);
		}
		try {
			const img = await loadImage(url);
			this.imageCache.set(url, img);
			// Limit cache size
			if (this.imageCache.size > 200) {
				const firstKey = this.imageCache.keys().next().value;
				this.imageCache.delete(firstKey);
			}
			return img;
		} catch (error) {
			return null;
		}
	}

	/**
	 * Generate a match summary image for the player
	 */
	static async generateMatchImage(participant, win, score) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;

		const width = 450;
		const height = 220;
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		// Background
		const gradient = ctx.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, win ? '#1a3a5c' : '#5c1a1a');
		gradient.addColorStop(1, win ? '#0d1f30' : '#300d0d');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);

		// Border
		ctx.strokeStyle = win ? '#3498db' : '#e74c3c';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, width - 4, height - 4);

		// Preload all images in parallel
		const items = [
			participant.item0, participant.item1, participant.item2,
			participant.item3, participant.item4, participant.item5, participant.item6
		].filter(id => id && id > 0);

		const imageUrls = [
			`${DDRAGON_BASE}/img/champion/${participant.championName}.png`,
			...items.map(id => `${DDRAGON_BASE}/img/item/${id}.png`)
		];

		const loadedImages = await Promise.all(imageUrls.map(url => this.loadImageCached(url)));
		const champImg = loadedImages[0];
		const itemImages = loadedImages.slice(1);

		// Draw champion
		if (champImg) {
			ctx.drawImage(champImg, 15, 15, 80, 80);
		}

		// Text
		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 22px ${fontFamily}`;
		ctx.fillText(participant.championName || 'Unknown', 110, 40);

		ctx.font = `18px ${fontFamily}`;
		ctx.fillStyle = '#cccccc';
		ctx.fillText(`${participant.kills || 0}/${participant.deaths || 0}/${participant.assists || 0}`, 110, 65);

		ctx.font = `14px ${fontFamily}`;
		ctx.fillStyle = '#888888';
		ctx.fillText(`Level ${participant.champLevel || 1}`, 110, 88);

		ctx.font = `bold 16px ${fontFamily}`;
		ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
		ctx.fillText(win ? 'VICTORY' : 'DEFEAT', 320, 40);

		// Score bar
		const scoreNum = Number.isFinite(score) ? Math.round(score) : 0;

		ctx.fillStyle = '#222222';
		ctx.fillRect(15, 115, 420, 25);
		ctx.strokeStyle = '#444444';
		ctx.lineWidth = 1;
		ctx.strokeRect(15, 115, 420, 25);

		const scoreWidth = (scoreNum / 100) * 420;
		ctx.fillStyle = scoreNum >= 80 ? '#2ecc71' : scoreNum >= 60 ? '#f1c40f' : scoreNum >= 40 ? '#e67e22' : '#e74c3c';
		if (scoreWidth > 0) ctx.fillRect(15, 115, scoreWidth, 25);

		ctx.fillStyle = '#ffffff';
		ctx.font = `bold 14px ${fontFamily}`;
		ctx.textAlign = 'center';
		ctx.fillText(`${scoreNum}/100 Performance`, 225, 133);
		ctx.textAlign = 'left';

		// Items
		const allItems = [
			participant.item0, participant.item1, participant.item2,
			participant.item3, participant.item4, participant.item5
		];

		let itemX = 15;
		let itemIdx = 0;
		for (const itemId of allItems) {
			if (itemId && itemId > 0 && itemImages[itemIdx]) {
				ctx.drawImage(itemImages[itemIdx], itemX, 155, 50, 50);
				itemIdx++;
			} else {
				ctx.fillStyle = '#1a1a1a';
				ctx.fillRect(itemX, 155, 50, 50);
			}
			itemX += 55;
		}

		// Trinket
		if (participant.item6 && participant.item6 > 0 && itemImages[itemIdx]) {
			ctx.drawImage(itemImages[itemIdx], itemX + 20, 155, 50, 50);
		}

		return canvas.toBuffer('image/png');
	}

	/**
	 * Generate a compact team composition image
	 */
	static async generateTeamImage(teamParticipants, isWinningTeam, focusPuuid = null) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;

		const width = 420;
		const rowHeight = 50;
		const height = rowHeight * teamParticipants.length + 15;
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		// Background & border
		ctx.fillStyle = isWinningTeam ? '#0d1f30' : '#300d0d';
		ctx.fillRect(0, 0, width, height);
		ctx.strokeStyle = isWinningTeam ? '#3498db' : '#e74c3c';
		ctx.lineWidth = 3;
		ctx.strokeRect(1, 1, width - 2, height - 2);

		// Preload ALL images in parallel
		const allUrls = [];
		for (const player of teamParticipants) {
			allUrls.push(`${DDRAGON_BASE}/img/champion/${player.championName}.png`);
			for (let i = 0; i <= 6; i++) {
				const itemId = player[`item${i}`];
				if (itemId && itemId > 0) {
					allUrls.push(`${DDRAGON_BASE}/img/item/${itemId}.png`);
				}
			}
		}

		// Load all at once
		const loadPromises = allUrls.map(url => this.loadImageCached(url));
		await Promise.all(loadPromises);

		let y = 8;
		for (const player of teamParticipants) {
			const isHighlighted = focusPuuid && player.puuid === focusPuuid;

			if (isHighlighted) {
				ctx.fillStyle = isWinningTeam ? '#1a4a7c' : '#7c2a2a';
				ctx.fillRect(5, y - 3, width - 10, rowHeight - 5);
			}

			// Champion
			const champImg = await this.loadImageCached(`${DDRAGON_BASE}/img/champion/${player.championName}.png`);
			if (champImg) ctx.drawImage(champImg, 8, y, 38, 38);

			// KDA
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 13px ${fontFamily}`;
			ctx.fillText(`${player.kills}/${player.deaths}/${player.assists}`, 52, y + 25);

			// Items
			let itemX = 115;
			for (let i = 0; i <= 6; i++) {
				const itemId = player[`item${i}`];
				if (itemId && itemId > 0) {
					const itemImg = await this.loadImageCached(`${DDRAGON_BASE}/img/item/${itemId}.png`);
					if (itemImg) ctx.drawImage(itemImg, itemX, y + 5, 28, 28);
					else {
						ctx.fillStyle = '#1a1a1a';
						ctx.fillRect(itemX, y + 5, 28, 28);
					}
				} else {
					ctx.fillStyle = '#1a1a1a';
					ctx.fillRect(itemX, y + 5, 28, 28);
				}
				itemX += 30;
			}

			y += rowHeight;
		}

		return canvas.toBuffer('image/png');
	}
}

module.exports = MatchImageGenerator;
