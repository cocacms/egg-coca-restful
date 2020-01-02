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

  getWhere(it) {
    const where = {};
    if (it.method
      && it.value &&
      it.key &&
      this.app.Sequelize.Op[it.method]) {
      where[it.key] = {
        [this.app.Sequelize.Op[it.method]]: it.value,
      };
    } else if (
      (['string', 'number', 'boolean'].includes(typeof it.value) || Array.isArray(it.value)) &&
      !it.method
    ) {
      if (Array.isArray(it.value) && it.value.length === 1) {
        where[it.key] = it.value[0];
      } else {
        where[it.key] = it.value;
      }
    }
    return where;
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
    } catch (e) {
      sorter = {};
    }

    if (sorter.field) {
      const order = [];
      if (sorter.association) {
        order.push(sorter.association);
      }
      order.push(sorter.field);
      order.push(sorter.order === 'ascend' ? 'ASC' : 'DESC');
      option.order = [order];
    }

    const includeWhere = [];
    if (filters.length > 0) {
      option.where = {};
      for (let it of filters) {
        try {
          it = JSON.parse(it);
        } catch (e) {
          continue;
        }

        if (it.key.indexOf('->') !== -1) {
          includeWhere.push(it);
          continue;
        }

        const where = this.getWhere(it);
        option.where = {
          ...where,
          ...option.where,
        };
      }
    }

    if (include && Array.isArray(include)) {
      include = include.map(i => {
        try {
          const includeOption = JSON.parse(i);
          const _ = {
            association: includeOption.association,
            attributes: includeOption.attributes,
          };

          if (typeof includeOption.required === 'boolean') {
            _.required = includeOption.required;
          }

          return _;
        } catch (error) {
          return {
            association: i,
          };
        }
      });

      if (includeWhere.length > 0) {
        include = include.map(i => {
          const targets = includeWhere.filter(it => {
            const keys = it.key.split('->', 2);
            if (keys[0] === i.association) return true;
            return false;
          });

          if (targets.length > 0) {
            let where = {};
            for (const target of targets) {
              const keys = target.key.split('->', 2);
              where = {
                ...where,
                ...this.getWhere({
                  ...target,
                  key: keys[1],
                }),
              };
            }

            return {
              ...i,
              where,
            };
          }
          return i;
        });
      }
      option.include = include;
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
