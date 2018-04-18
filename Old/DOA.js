const _ = require("lodash");

const Process = require("./Process");
const Pull = require("./Messaging/Pull");
const Pub = require("./Messaging/Pub");
const Sub = require("./Messaging/Sub");

const SIMULATION_INTERVAL = 1000;

class DOA extends Process {
  constructor(options) {
    super(options);
  }

  start(params) {
    this.simulation = params.simulation;  
    this.disease = params.disease;
    this.currentHour = 0;
    this.diseaseCounts = Array(this.simulation.simulationTime).fill(0);
    this.outbreaking = false;

    this.diseaseOutbreakPub = new Pub(params.bindings.notification);
    this.requestName("hds.update").then((data) => this.subscribeToHds(data));

    // Update simulation every second
    setInterval(() => this.updateSimulation(), SIMULATION_INTERVAL);
  }

  subscribeToHds(hds) {
    this.diseaseUpdateSub = new Sub(hds, this.disease.id.toString());
    this.diseaseUpdateSub.on((data) => this.onDiseaseUpdate(data));
  }

  onDiseaseUpdate(data) {
    this.vectorTimestamp.update(data.vectorTimestamp);
    this.logger.debug("Disease update: " + JSON.stringify(_.omit(data, "vectorTimestamp"), null, 2));
    this.diseaseCounts[this.currentHour] += data.count;
    this.logger.debug("Disease counts: " + JSON.stringify(this.diseaseCounts));

    this.notifyOutbreaks();
  }

  notifyOutbreaks() {
    this.vectorTimestamp.update();
    let sum = _.sum(this.diseaseCounts);
    if (sum >= this.disease.threshold) {
      if (!this.outbreaking) {
        this.outbreaking = true;
        let message = {
          type: this.disease.id,
          infections: sum,
          vectorTimestamp: this.vectorTimestamp.get()
        };
        this.diseaseOutbreakPub.send(message, "outbreak");
        this.logger.debug("Published disease outbreak: " + JSON.stringify(_.omit(message, "vectorTimestamp"), null, 2));
      }
    } else if (this.outbreaking) {
      this.outbreaking = false;
      this.logger.debug("Outbreak ended: (" + this.disease.name + ") - " + sum + " Infections");
    }
  }

  updateSimulation() {
    this.vectorTimestamp.update();
    this.currentHour = (this.currentHour + 1) % this.simulation.simulationTime;
    this.diseaseCounts[this.currentHour] = 0;
  }
}

module.exports = DOA;
