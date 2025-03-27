const fs = require("fs");
const path = require("path");

class JsonTranslationVerifier {
  constructor(inputDir, mappingFile) {
    this.inputDir = inputDir;
    this.mappingFile = mappingFile;
    this.missingTranslations = {};
    this.mismatchedTranslations = {};
  }

  loadMapping() {
    if (fs.existsSync(this.mappingFile)) {
      return JSON.parse(fs.readFileSync(this.mappingFile));
    }
    console.error("Mapping-Datei nicht gefunden.");
    process.exit(1);
  }

  getJsonFiles() {
    return fs.readdirSync(this.inputDir).filter(file => file.endsWith(".json"));
  }

  verifyFiles() {
    const mapping = this.loadMapping();
    const files = this.getJsonFiles();
    
    files.forEach(file => {
      const filePath = path.join(this.inputDir, file);
      const jsonData = JSON.parse(fs.readFileSync(filePath));
      this.verifyTranslations(jsonData, mapping, file);
    });

    this.reportResults();
  }

  verifyTranslations(obj, mapping, fileName) {
    if (typeof obj !== "object" || obj === null) return;

    if (obj.name_en) {
      this.checkTranslation(obj, mapping, fileName);
    }

    Object.values(obj).forEach(value => {
      if (typeof value === "object") {
        this.verifyTranslations(value, mapping, fileName);
      }
    });
  }

  checkTranslation(obj, mapping, fileName) {
    const nameEn = obj.name_en.trim();
    const expectedTranslations = mapping.global[nameEn] || (mapping.files[fileName] ? mapping.files[fileName][nameEn] : null);
    
    if (!expectedTranslations) {
      this.missingTranslations[fileName] = this.missingTranslations[fileName] || [];
      this.missingTranslations[fileName].push(nameEn);
      return;
    }

    ["name_de", "name_fr", "name_es"].forEach(lang => {
      if (obj[lang] && obj[lang] !== expectedTranslations[lang]) {
        this.mismatchedTranslations[fileName] = this.mismatchedTranslations[fileName] || {};
        this.mismatchedTranslations[fileName][nameEn] = {
          expected: expectedTranslations[lang],
          found: obj[lang]
        };
      }
    });
  }

  reportResults() {
    console.log("Überprüfung abgeschlossen.");
    if (Object.keys(this.missingTranslations).length > 0) {
      console.log("Fehlende Übersetzungen:", JSON.stringify(this.missingTranslations, null, 2));
    }
    if (Object.keys(this.mismatchedTranslations).length > 0) {
      console.log("Abweichende Übersetzungen:", JSON.stringify(this.mismatchedTranslations, null, 2));
    }
    if (Object.keys(this.missingTranslations).length === 0 && Object.keys(this.mismatchedTranslations).length === 0) {
      console.log("Alle Übersetzungen stimmen mit der Mapping-Datei überein.");
    }
  }
}

const inputDir = "./public/games/the-old-world/";
const mappingFile = "./scripts/translationMapping/translationMapping.json";
const verifier = new JsonTranslationVerifier(inputDir, mappingFile);
verifier.verifyFiles();
