const fs = require("fs");
const path = require("path");

class JsonTranslator {
  constructor(inputDir, outputFile) {
    this.inputDir = inputDir;
    this.outputFile = outputFile;
    this.configFile = "./scripts/translationMapping/config.json";
    this.fileTranslations = {}; // Pro Datei spezifische Übersetzungen
    this.globalTranslations = {}; // Dateiübergreifende Übersetzungen
    this.translationFiles = {}; // Speichert, in welchen Dateien ein Begriff vorkommt
    this.existingTranslations = this.loadExistingTranslations();
  }

  loadExistingTranslations() {
    if (fs.existsSync(this.outputFile)) {
      return JSON.parse(fs.readFileSync(this.outputFile));
    }
    return { global: {}, files: {} };
  }

  loadConfiguredFiles() {
    if (fs.existsSync(this.configFile)) {
      const config = JSON.parse(fs.readFileSync(this.configFile));
      return config.files || [];
    }
    return null;
  }

  isMeaningfulText(text) {
    return /[a-zA-Z]/.test(text); // Enthält der Text Buchstaben?
  }

  extractTranslations(obj, translations, fileName) {
    if (typeof obj !== "object" || obj === null) return;

    if (obj.name_en) {
      this.processTranslationEntry(obj, translations, fileName);
    }

    Object.values(obj).forEach(value => {
      if (typeof value === "object") {
        this.extractTranslations(value, translations, fileName);
      }
    });
  }

  processTranslationEntry(obj, translations, fileName) {
    const namesEn = obj.name_en.split(",").map(name => name.trim());
    const namesDe = this.splitAndTrim(obj.name_de);
    const namesFr = this.splitAndTrim(obj.name_fr);
    const namesEs = this.splitAndTrim(obj.name_es);

    namesEn.forEach((name, index) => {
      this.addTranslationEntry(name, index, namesDe, namesFr, namesEs, translations, fileName);
    });
  }

  splitAndTrim(value) {
    return value ? value.split(",").map(name => name.trim()) : [];
  }

  addTranslationEntry(name, index, namesDe, namesFr, namesEs, translations, fileName) {
    if (!translations[name]) {
      translations[name] = { name_de: "", name_fr: "", name_es: "" };
    }

    const checkMeaningful = this.isMeaningfulText(name);

    this.updateTranslationField(translations[name], "name_de", namesDe, index, name, checkMeaningful);
    this.updateTranslationField(translations[name], "name_fr", namesFr, index, name, checkMeaningful);
    this.updateTranslationField(translations[name], "name_es", namesEs, index, name, checkMeaningful);

    if (!this.translationFiles[name]) {
      this.translationFiles[name] = new Set();
    }
    this.translationFiles[name].add(fileName);
  }

  updateTranslationField(translation, field, names, index, name, checkMeaningful) {
    if (names[index] && (names[index] !== name || !checkMeaningful) && !translation[field]) {
      translation[field] = names[index];
    }
  }

  processFiles() {
    let files = this.loadConfiguredFiles();
    if (!files) {
      files = this.getJsonFiles();
    }
    this.processEachFile(files);
    this.identifyGlobalTranslations();
    this.cleanFileSpecificTranslations();
    this.mergeWithExistingTranslations();
    this.saveTranslations();
  }

  getJsonFiles() {
    return fs.readdirSync(this.inputDir).filter(file => file.endsWith(".json"));
  }

  processEachFile(files) {
    files.forEach(file => {
      const filePath = path.join(this.inputDir, file);
      if (fs.existsSync(filePath)) {
        const rawData = fs.readFileSync(filePath);
        const jsonData = JSON.parse(rawData);

        this.fileTranslations[file] = {};
        this.extractTranslations(jsonData, this.fileTranslations[file], file);
      }
    });
  }

  identifyGlobalTranslations() {
    for (const file in this.fileTranslations) {
      for (const key in this.fileTranslations[file]) {
        if (this.translationFiles[key].size >= 3) {
          if (!this.globalTranslations[key]) {
            this.globalTranslations[key] = { ...this.fileTranslations[file][key] };
          } else {
            ["name_de", "name_fr", "name_es"].forEach(lang => {
              if (!this.globalTranslations[key][lang] && this.fileTranslations[file][key][lang]) {
                this.globalTranslations[key][lang] = this.fileTranslations[file][key][lang];
              }
            });
          }
        }
      }
    }
  }

  cleanFileSpecificTranslations() {
    for (const file in this.fileTranslations) {
      for (const key in this.globalTranslations) {
        if (this.translationFiles[key].size >= 3) {
          delete this.fileTranslations[file][key];
        }
      }
    }
  }

  mergeWithExistingTranslations() {
    const mergeTranslations = (newTranslations, existingTranslations) => {
      for (const key in newTranslations) {
        if (!existingTranslations[key]) {
          existingTranslations[key] = newTranslations[key];
        } else {
          ["name_de", "name_fr", "name_es"].forEach(lang => {
            if (!existingTranslations[key][lang] && newTranslations[key][lang]) {
              existingTranslations[key][lang] = newTranslations[key][lang];
            }
          });
        }
      }
    };

    mergeTranslations(this.globalTranslations, this.existingTranslations.global);

    for (const file in this.fileTranslations) {
      if (!this.existingTranslations.files[file]) {
        this.existingTranslations.files[file] = {};
      }
      mergeTranslations(this.fileTranslations[file], this.existingTranslations.files[file]);
    }
  }

  saveTranslations() {
    const sortedTranslations = {
      global: this.sortObject(this.existingTranslations.global),
      files: this.sortObject(this.existingTranslations.files, true)
    };

    fs.writeFileSync(this.outputFile, JSON.stringify(sortedTranslations, null, 2));
    console.log(`Übersetzungsdatei wurde aktualisiert: ${this.outputFile}`);
  }

  sortObject(obj, recursive = false) {
    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = recursive && typeof obj[key] === "object" ? this.sortObject(obj[key], true) : obj[key];
        return sorted;
      }, {});
  }
}

const inputDir = "./public/games/the-old-world/";
const outputFile = "./scripts/translationMapping/translationMapping.json";
const translator = new JsonTranslator(inputDir, outputFile);
translator.processFiles();
