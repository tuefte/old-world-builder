const fs = require("fs");
const path = require("path");

class JsonValidator {
    constructor(inputDir, detailedOutput = false, languageFilter = null) {
        this.inputDir = inputDir;
        this.detailedOutput = detailedOutput;
        this.languageFilter = languageFilter ? `name_${languageFilter}` : null;
        this.configFiles = this.loadConfig();
        this.errors = {};
        this.languageLabels = {
            name_de: "[DE] German",
            name_fr: "[FR] French",
            name_es: "[ES] Spanish",
            name_it: "[IT] Italian",
            name_pl: "[PL] Polish"
        };
        this.rootDir = process.cwd();
    }

    loadConfig() {
        const configPath = path.join(this.inputDir, "config.json");
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
            if (config.files && Array.isArray(config.files) && config.files.length > 0) {
                return config.files.filter(file => file.endsWith(".json"));
            }
        }
        return fs.readdirSync(this.inputDir).filter(file => file.endsWith(".json"));
    }

    validateFiles() {
        this.configFiles.forEach(file => {
            const filePath = path.join(this.inputDir, file);
            const rawData = fs.readFileSync(filePath, "utf8");
            const jsonData = JSON.parse(rawData);
            const lines = rawData.split("\n");

            this.validateTranslations(jsonData, file, lines);
        });

        this.reportResults();
    }

    validateTranslations(obj, fileName, lines, inheritedId = null) {
        if (typeof obj !== "object" || obj === null) return;

        const objectId = obj.id ? obj.id : inheritedId;

        if (obj.name_en && objectId) {
            this.checkTranslationConsistency(obj, fileName, lines, objectId);
        }

        Object.entries(obj).forEach(([key, value]) => {
            if (typeof value === "object") {
                const newId = objectId ? `${objectId}->${key}` : null;
                this.validateTranslations(value, fileName, lines, newId);
            }
        });
    }

    checkTranslationConsistency(obj, fileName, lines, objectId) {
        const namesEn = this.splitAndTrim(obj.name_en);
        const languageFields = ["name_de", "name_fr", "name_es", "name_it", "name_pl"];

        const lineNumber = this.findLineNumber(lines, `"name_en": "${obj.name_en}"`);

        languageFields.forEach(field => {
            if (obj[field]) {
                this.compareTextCount(namesEn, this.splitAndTrim(obj[field]), fileName, field, lineNumber, objectId);
            }
        });
    }

    splitAndTrim(value) {
        return value ? value.split(",").map(name => name.trim()) : [];
    }

    compareTextCount(reference, translation, fileName, field, lineNumber, objectId) {
        if (this.languageFilter && field !== this.languageFilter) return;

        if (translation.length > 0 && translation.length !== reference.length) {
            if (!this.errors[fileName]) {
                this.errors[fileName] = {};
            }
            if (!this.errors[fileName][field]) {
                this.errors[fileName][field] = [];
            }

            const filePath = path.join(this.inputDir, fileName);
            const vsCodeLink = `vscode://file//${this.rootDir}/${filePath}:${lineNumber}`;
            const errorMessage = `     🔸 \x1b[34m\x1b]8;;${vsCodeLink}\x1b\\[Line ${lineNumber}]\x1b]8;;\x1b\\\x1b[32m ${objectId}: \x1b[0m${field} count mismatch (${translation.length} instead of ${reference.length})`;

            this.errors[fileName][field].push(errorMessage);
        }
    }

    findLineNumber(lines, searchString) {
        return lines.findIndex(line => line.includes(searchString)) + 1;
    }

    reportResults() {
        if (Object.keys(this.errors).length > 0) {
            console.log("\n❌ Validation errors found:");

            for (const file in this.errors) {
                console.log(`\n📂 File: ${file}`);

                for (const language in this.errors[file]) {
                    console.log(`  🏳 Language: ${this.languageLabels[language]}`);
                    this.errors[file][language].forEach(error => console.log(error));
                }
            }
        } else {
            console.log("\n✅ All files are valid!");
        }
    }
}

// CLI Parameter Handling
const args = process.argv.slice(2);
const detailedOutput = args.includes("--detailed");
const langArg = args.find(arg => arg.startsWith("--lang="));
const languageFilter = langArg ? langArg.split("=")[1] : null;

// Example usage
const inputDir = "./public/games/the-old-world/";
const validator = new JsonValidator(inputDir, detailedOutput, languageFilter);
validator.validateFiles();
