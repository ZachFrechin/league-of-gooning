const fs = require('fs');
const path = require('path');

class LoldleService {
	constructor() {
		this.champions = [];
		this.loadData();
	}

	loadData() {
		const filePath = path.join(__dirname, '..', 'result_loldle.csv');
		const content = fs.readFileSync(filePath, 'utf-8');
		const lines = content.split('\n');

		// Skip header
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			// Custom CSV parser to handle quoted parts with commas
			const parts = [];
			let current = '';
			let inQuotes = false;

			for (let char of line) {
				if (char === '"') {
					inQuotes = !inQuotes;
				} else if (char === ',' && !inQuotes) {
					parts.push(current);
					current = '';
				} else {
					current += char;
				}
			}
			parts.push(current);

			if (parts.length < 8) continue;

			const [championName, gender, positionsRaw, speciesRaw, resource, rangeTypeRaw, regionsRaw, releaseDate] = parts;

			this.champions.push({
				name: championName,
				gender: gender,
				positions: this.parseList(positionsRaw),
				species: this.parseList(speciesRaw),
				resource: resource,
				rangeType: this.parseList(rangeTypeRaw),
				regions: this.parseList(regionsRaw),
				releaseDate: releaseDate,
				year: parseInt(releaseDate.split('-')[0])
			});
		}
	}

	parseList(raw) {
		// raw is like "['Top', 'Jungle']" or "['Human']"
		try {
			return raw
				.replace(/[\[\]']/g, '') // remove [, ], and '
				.split(',')
				.map(s => s.trim())
				.filter(s => s !== '');
		} catch (e) {
			return [];
		}
	}

	getDailyChampion() {
		const today = new Date().toISOString().split('T')[0];
		const dateHash = today.split('-').join('');
		const seed = parseInt(dateHash) * 16381 + 7;
		const index = seed % this.champions.length;
		return this.champions[index];
	}

	getChampionByName(name) {
		return this.champions.find(c => c.name.toLowerCase() === name.toLowerCase());
	}

	compare(guessName, targetChamp) {
		const guessChamp = this.getChampionByName(guessName);
		if (!guessChamp) return null;

		const result = {
			champion: guessChamp,
			gender: this.compareValue(guessChamp.gender, targetChamp.gender),
			positions: this.compareList(guessChamp.positions, targetChamp.positions),
			species: this.compareList(guessChamp.species, targetChamp.species),
			resource: this.compareValue(guessChamp.resource, targetChamp.resource),
			rangeType: this.compareList(guessChamp.rangeType, targetChamp.rangeType),
			regions: this.compareList(guessChamp.regions, targetChamp.regions),
			year: this.compareYear(guessChamp.year, targetChamp.year)
		};

		return result;
	}

	compareValue(guess, target) {
		return guess === target ? 'CORRECT' : 'INCORRECT';
	}

	compareList(guessList, targetList) {
		const identical = guessList.length === targetList.length &&
			guessList.every(val => targetList.includes(val));

		if (identical) return 'CORRECT';

		const hasCommon = guessList.some(val => targetList.includes(val));
		if (hasCommon) return 'PARTIAL';

		return 'INCORRECT';
	}

	compareYear(guessYear, targetYear) {
		if (guessYear === targetYear) return 'CORRECT';
		return guessYear < targetYear ? 'HIGHER' : 'LOWER';
	}

	getEmoji(status) {
		switch (status) {
			case 'CORRECT': return '🟩';
			case 'PARTIAL': return '🟧';
			case 'INCORRECT': return '🟥';
			case 'HIGHER': return '⬆️';
			case 'LOWER': return '⬇️';
			default: return '⬜';
		}
	}
}

module.exports = new LoldleService();
