'use strict';

const Service = require('egg').Service;

const CURRENTMODEL = Symbol('Application#current_model');

class CurdService extends Service {
  get model() {
    return this[CURRENTMODEL];
  }

  set model(value) {
    this[CURRENTMODEL] = value;
  }

  buildSqlOption() {
    let { filters = [], include = [] } = this.ctx.queries;
    let {
      page = 1,
      pageSize = 10,
      sorter = '{}',
      pager = true,
    } = this.ctx.query;

    const option = {
      pager: pager !== 'false',
    };

    if (pager !== 'false') {
      page = Number(page);
      pageSize = Number(pageSize);
      option.offset = (page - 1) * pageSize;
      option.limit = pageSize;
    }

    try {
      sorter = JSON.parse(sorter);
      if (sorter.field) {
        const order = [];
        if (sorter.association) {
          order.push(sorter.association);
        }
        order.push(sorter.field);
        order.push(sorter.order === 'ascend' ? 'ASC' : 'DESC' );
        option.order = [ order ];
      }

      if (filters.length > 0) {
        option.where = {};
        for (let it of filters) {
          it = JSON.parse(it);
          if (it.value instanceof Array) {
            if (it.value.length === 1) {
              option.where[it.key] = it.value[0];
            } else {
              option.where[it.key] = it.value;
            }
          } else if (
            [ 'string', 'number', 'boolean' ].includes(typeof it.value) &&
            !it.method
          ) {
            option.where[it.key] = it.value;
          } else if (
            it.method &&
            it.value &&
            it.key &&
            this.app.Sequelize.Op[it.method]
          ) {
            option.where[it.key] = {
              [this.app.Sequelize.Op[it.method]]: it.value,
            };
          }
        }
      }

      if (include && Array.isArray(include)) {
        include = include.map(i => {
          try {
            const includeOption = JSON.parse(i);
            return {
              association: includeOption.association,
              attributes: includeOption.attributes,
              required: includeOption.required || false,
            };
          } catch (error) {
            return {
              association: i,
            };
          }
        });
        option.include = include;
      }
    } catch (e) {
      // console.log(e);
    }

    return option;
  }

  async index() {
    const option = this.buildSqlOption();
    if (option.pager) {
      this.ctx.body = await this.model.findAndCountAll({
        ...option,
        distinct: true,
      });
    } else {
      this.ctx.body = await this.model.findAll({
        ...option,
      });
    }
  }

  async show() {
    const option = this.buildSqlOption();
    let include = [];
    if (option.include) include = option.include;
    this.ctx.body = await this.model.findByPk(this.ctx.params.id, {
      include,
    });
  }

  async create() {
    const { links = [] } = this.ctx.queries;
    const data = this.ctx.request.body;
    if (new this.model()._isAttribute('user_id')) {
      data.user_id = this.ctx.logined.id;
    }
    this.ctx.body = await this.model.create(data);

    for (const link of links) {
      if (
        this.ctx.body[`set${link}`] &&
        this.ctx.request.body[link.toLowerCase()]
      ) {
        await this.ctx.body[`set${link}`](
          this.ctx.request.body[link.toLowerCase()]
        );
      }
    }
  }

  async update() {
    const { links = [] } = this.ctx.queries;
    const instance = await this.model.findByPk(this.ctx.params.id);
    this.ctx.body = await instance.update(this.ctx.request.body);

    for (const link of links) {
      if (instance[`set${link}`] && this.ctx.request.body[link.toLowerCase()]) {
        await instance[`set${link}`]([]);
        await instance[`set${link}`](this.ctx.request.body[link.toLowerCase()]);
      }
    }
  }

  async destroy() {
    this.ctx.body = await this.model.destroy({
      where: { id: this.ctx.params.id },
    });
  }
}

module.exports = CurdService;
