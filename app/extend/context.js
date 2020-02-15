"use strict";
const CONTEXTWHERE = Symbol("Context#context_where");

module.exports = {
  /**
   * where 上下文
   */
  get where() {
    return this[CONTEXTWHERE] || {};
  },

  set where(value) {
    this[CONTEXTWHERE] = value;
  }
};
