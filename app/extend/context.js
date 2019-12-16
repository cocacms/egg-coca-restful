'use strict';
const CURRENTMODEL = Symbol('Context#current_model');

module.exports = {
  get current_model() {
    if (!this[CURRENTMODEL]) {
      this.throw('模型不存在');
    }
    return this[CURRENTMODEL];
  },

  set current_model(value) {
    this[CURRENTMODEL] = value;
  },
};
