const { createCanvas, loadImage } = require('canvas');
const axios = require('axios');

class MatchImageGenerator {
	static cachedVersion = null;
	static versionCacheTime = 0;

	/**
	 * Get the latest DDragon version dynamically
	 */
	static async getLatestVersion() {
		// Cache version for 1 hour
		if (this.cachedVersion && Date.now() - this.versionCacheTime < 3600000) {
			return this.cachedVersion;
		}

		try {
			const response = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
			this.cachedVersion = response.data[0]; // Latest version is first
			this.versionCacheTime = Date.now();
			console.log(`[DDragon] Using version: ${this.cachedVersion}`);
			return this.cachedVersion;
		} catch (error) {
			console.error('Failed to fetch DDragon version:', error.message);
			return '14.24.1'; // Fallback
		}
	}

	/**
	 * Generate a match summary image
	 */
	static async generateMatchImage(participant, win, score) {
		const version = await this.getLatestVersion();
		const DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${version}`;

		const width = 450;
		const height = 220;
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

		// Use Noto Sans font (installed in Docker)
		const fontFamily = '"Noto Sans", "Noto Sans CJK SC", sans-serif';

		// Background gradient
		const gradient = ctx.createLinearGradient(0, 0, width, height);
		if (win) {
			gradient.addColorStop(0, '#1a3a5c');
			gradient.addColorStop(1, '#0d1f30');
		} else {
			gradient.addColorStop(0, '#5c1a1a');
			gradient.addColorStop(1, '#300d0d');
		}
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);

		// Border
		ctx.strokeStyle = win ? '#3498db' : '#e74c3c';
		ctx.lineWidth = 4;
		ctx.strokeRect(2, 2, width - 4, height - 4);

		try {
			// Champion icon (top left)
			const champUrl = `${DDRAGON_BASE}/img/champion/${participant.championName}.png`;
			const champImg = await this.loadImageSafe(champUrl);
			if (champImg) {
				ctx.drawImage(champImg, 15, 15, 80, 80);
			}

			// Champion name
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 22px ${fontFamily}`;
			ctx.fillText(participant.championName || 'Unknown', 110, 40);

			// KDA
			ctx.font = `18px ${fontFamily}`;
			ctx.fillStyle = '#cccccc';
			const kda = `${participant.kills || 0}/${participant.deaths || 0}/${participant.assists || 0}`;
			ctx.fillText(kda, 110, 65);

			// Level
			ctx.font = `14px ${fontFamily}`;
			ctx.fillStyle = '#888888';
			ctx.fillText(`Level ${participant.champLevel || 1}`, 110, 88);

			// Win/Loss badge
			ctx.font = `bold 16px ${fontFamily}`;
			ctx.fillStyle = win ? '#2ecc71' : '#e74c3c';
			ctx.fillText(win ? 'VICTORY' : 'DEFEAT', 320, 40);

			// Ensure score is a valid number
			const scoreNum = Number.isFinite(score) ? Math.round(score) : 0;
			console.log(`[MatchImage] Score received: ${score}, parsed: ${scoreNum}`);

			// Score bar background
			ctx.fillStyle = '#222222';
			ctx.fillRect(15, 115, 420, 25);

			// Score bar border
			ctx.strokeStyle = '#444444';
			ctx.lineWidth = 1;
			ctx.strokeRect(15, 115, 420, 25);

			// Score bar fill
			const scoreWidth = (scoreNum / 100) * 420;
			if (scoreNum >= 80) ctx.fillStyle = '#2ecc71';
			else if (scoreNum >= 60) ctx.fillStyle = '#f1c40f';
			else if (scoreNum >= 40) ctx.fillStyle = '#e67e22';
			else ctx.fillStyle = '#e74c3c';

			if (scoreWidth > 0) {
				ctx.fillRect(15, 115, scoreWidth, 25);
			}

			// Score text
			ctx.fillStyle = '#ffffff';
			ctx.font = `bold 14px ${fontFamily}`;
			ctx.textAlign = 'center';
			ctx.fillText(`${scoreNum}/100 Performance`, 225, 133);
			ctx.textAlign = 'left';

			// Items row (bottom)
			const items = [
				participant.item0, participant.item1, participant.item2,
				participant.item3, participant.item4, participant.item5
			];

			let itemX = 15;
			const itemSize = 50;
			const itemSpacing = 55;

			for (const itemId of items) {
				if (itemId && itemId > 0) {
					const itemUrl = `${DDRAGON_BASE}/img/item/${itemId}.png`;
					const itemImg = await this.loadImageSafe(itemUrl);
					if (itemImg) {
						ctx.drawImage(itemImg, itemX, 155, itemSize, itemSize);
					} else {
						this.drawEmptySlot(ctx, itemX, 155, itemSize);
					}
				} else {
					this.drawEmptySlot(ctx, itemX, 155, itemSize);
				}
				itemX += itemSpacing;
			}

			// Trinket (last slot, slightly separated)
			const trinketId = participant.item6;
			if (trinketId && trinketId > 0) {
				const trinketUrl = `${DDRAGON_BASE}/img/item/${trinketId}.png`;
				const trinketImg = await this.loadImageSafe(trinketUrl);
				if (trinketImg) {
					ctx.drawImage(trinketImg, itemX + 20, 155, itemSize, itemSize);
				} else {
					this.drawEmptySlot(ctx, itemX + 20, 155, itemSize);
				}
			}

		} catch (error) {
			console.error('Error generating image:', error.message);
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 24px sans-serif';
			ctx.fillText(participant.championName || 'Unknown', 50, 80);
		}

		return canvas.toBuffer('image/png');
	}

	static async loadImageSafe(url) {
		try {
			return await loadImage(url);
		} catch (error) {
			console.warn(`Failed to load image: ${url}`);
			return null;
		}
	}

	static drawEmptySlot(ctx, x, y, size) {
		ctx.fillStyle = '#1a1a1a';
		ctx.fillRect(x, y, size, size);
		ctx.strokeStyle = '#333333';
		ctx.lineWidth = 1;
		ctx.strokeRect(x, y, size, size);
	}
}

module.exports = MatchImageGenerator;
