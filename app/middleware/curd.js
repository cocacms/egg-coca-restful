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

class CurdCallable {
  constructor(_model, _methods) {
    this.model = _model;
    if (!Array.isArray(_methods)) {
      this.methods = [ _methods ];
    } else {
      this.methods = _methods;
    }
  }

  patchRestApi() {
    const rests = this.methods.length === 0 ? REST_MAP : this.methods;

    rests.forEach(method => {
      this[method] = async ctx => {
        if (ctx.service.curd[method]) {
          ctx.service.curd.model = this.model;
          await ctx.service.curd[method]();
        }
      };
    });
  }
}

module.exports = (model, methods = []) => {
  const curd = new CurdCallable(model, methods);
  curd.patchRestApi();
  return curd;
};
