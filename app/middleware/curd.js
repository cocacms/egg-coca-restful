'use strict';

const REST_MAP = [
  'index',
  'new',
  'create',
  'show',
  'edit',
  'update',
  'destroy',
];

module.exports = (model, method = false) => {
  class CurdCallable {
    constructor(_model) {
      this.model = _model;
    }

    patchRestApi() {
      REST_MAP.forEach(method => {
        this[method] = async ctx => {
          if (ctx.service.curd[method]) {
            ctx.service.curd.model = this.model;
            await ctx.service.curd[method]();
          }
        };
      });
    }
  }

  const curd = new CurdCallable(model);
  curd.patchRestApi();
  if (method === false) return curd;
  if (curd[method]) return curd[method];
};
