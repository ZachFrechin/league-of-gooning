const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

class MatchImageGenerator {
	static DDRAGON_VERSION = '14.24.1';
	static DDRAGON_BASE = `https://ddragon.leagueoflegends.com/cdn/${this.DDRAGON_VERSION}`;

	/**
	 * Generate a match summary image
	 * @param {Object} participant - Player participant data from Riot API
	 * @param {boolean} win - Whether the player won
	 * @param {number} score - Performance score (0-100)
	 * @returns {Buffer} - PNG image buffer
	 */
	static async generateMatchImage(participant, win, score) {
		const width = 400;
		const height = 200;
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext('2d');

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
			const champUrl = `${this.DDRAGON_BASE}/img/champion/${participant.championName}.png`;
			const champImg = await loadImage(champUrl);
			ctx.drawImage(champImg, 15, 15, 80, 80);

			// Champion name
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 20px Arial';
			ctx.fillText(participant.championName, 110, 40);

			// KDA
			ctx.font = '16px Arial';
			ctx.fillStyle = '#cccccc';
			const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;
			ctx.fillText(kda, 110, 65);

			// Level
			ctx.font = '14px Arial';
			ctx.fillStyle = '#888888';
			ctx.fillText(`Level ${participant.champLevel}`, 110, 85);

			// Score bar background
			ctx.fillStyle = '#333333';
			ctx.fillRect(15, 110, 370, 20);

			// Score bar fill
			const scoreWidth = (score / 100) * 370;
			if (score >= 80) ctx.fillStyle = '#2ecc71';
			else if (score >= 60) ctx.fillStyle = '#f1c40f';
			else if (score >= 40) ctx.fillStyle = '#e67e22';
			else ctx.fillStyle = '#e74c3c';
			ctx.fillRect(15, 110, scoreWidth, 20);

			// Score text
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 14px Arial';
			ctx.fillText(`${score}/100`, 175, 125);

			// Items row (bottom)
			const items = [
				participant.item0, participant.item1, participant.item2,
				participant.item3, participant.item4, participant.item5
			];

			let itemX = 15;
			for (const itemId of items) {
				if (itemId > 0) {
					try {
						const itemUrl = `${this.DDRAGON_BASE}/img/item/${itemId}.png`;
						const itemImg = await loadImage(itemUrl);
						ctx.drawImage(itemImg, itemX, 145, 45, 45);
					} catch (e) {
						// Draw placeholder if item image fails
						ctx.fillStyle = '#444444';
						ctx.fillRect(itemX, 145, 45, 45);
					}
				} else {
					// Empty slot
					ctx.fillStyle = '#222222';
					ctx.fillRect(itemX, 145, 45, 45);
					ctx.strokeStyle = '#444444';
					ctx.strokeRect(itemX, 145, 45, 45);
				}
				itemX += 50;
			}

			// Trinket
			if (participant.item6 > 0) {
				try {
					const trinketUrl = `${this.DDRAGON_BASE}/img/item/${participant.item6}.png`;
					const trinketImg = await loadImage(trinketUrl);
					ctx.drawImage(trinketImg, itemX + 20, 145, 45, 45);
				} catch (e) {
					ctx.fillStyle = '#444444';
					ctx.fillRect(itemX + 20, 145, 45, 45);
				}
			}

		} catch (error) {
			console.error('Error loading images:', error.message);
			// Fallback: just show text
			ctx.fillStyle = '#ffffff';
			ctx.font = 'bold 24px Arial';
			ctx.fillText(participant.championName, 50, 80);
			ctx.font = '18px Arial';
			ctx.fillText(`${participant.kills}/${participant.deaths}/${participant.assists}`, 50, 110);
		}

		return canvas.toBuffer('image/png');
	}
}

module.exports = MatchImageGenerator;
