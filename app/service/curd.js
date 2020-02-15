'use strict';

const Service = require('egg').Service;

const CURRENTMODEL = Symbol('Application#current_model');
const CURRENTMODELINITED = Symbol('Application#current_model_inited');

class CurdService extends Service {
  get model() {
    return this[CURRENTMODEL];
  }

  set model(value) {
    this[CURRENTMODEL] = value;
  }

  attributes_check(attributes) {
    if (!Array.isArray(attributes)) return [];
    return attributes.filter(i => typeof i === 'string');
  }

  where_check(where, include = false) {
    if (
      [ 'string', 'number', 'boolean' ].includes(typeof where) ||
      where === null
    ) {
      return where;
    }

    if (!where) return undefined;

    const Op = this.app.Sequelize.Op;
    const rt = {};

    for (const key in where) {
      if (typeof key !== 'string') {
        continue;
      }

      let t_key;
      if (key.indexOf('$') === 0 && Op[key.replace('$', '')]) {
        t_key = Op[key.replace('$', '')];
      } else if (this.is_attribute(key) || include) {
        t_key = key;
      }

      if (t_key) {
        const value = where[key];
        let t_value;

        if (Array.isArray(value)) {
          t_value = value.map(i => this.where_check(i));
        } else {
          t_value = this.where_check(value);
        }

        if (t_value !== undefined) rt[t_key] = t_value;
      } else {
        return undefined;
      }
    }
    return rt;
  }

  build_sql_option() {
    let { include = [], order = [], attributes = [] } = this.ctx.queries;
    let {
      page = 1,
      pageSize = 10,
      where = '{}',
      pager = 'true',
    } = this.ctx.query;

    const option = {
      pager: pager !== 'false',
    };

    /**
     * 分页处理
     */
    if (pager !== 'false') {
      page = Number(page);
      pageSize = Number(pageSize);
      option.offset = (page - 1) * pageSize;
      option.limit = pageSize;
    }

    /**
     * json格式化各种参数
     */
    try {
      where = JSON.parse(where);
    } catch (error) {
      where = {};
    }

    try {
      include = include.map(i => (i.indexOf('{') === 0 ? JSON.parse(i) : i));
    } catch (error) {
      include = [];
    }

    try {
      order = order.map(i => JSON.parse(i));
    } catch (error) {
      order = [];
    }

    if (order.length === 0 && this.is_attribute('id')) {
      order = [[ 'id', 'desc' ]]; // 默认按ID倒序数据
    }

    /**
     * 检查参数合法性
     */
    attributes = this.attributes_check(attributes);
    if (attributes.length > 0) option.attributes = attributes;

    order = order.filter(
      i =>
        Array.isArray(i) &&
        (i.length === 2 || i.length === 3) &&
        i.filter(ii => typeof ii !== 'string').length === 0 &&
        [ 'desc', 'asc' ].includes(i[i.length - 1].toLowerCase())
    );
    if (order.length > 0) option.order = order;

    include = include
      .filter(i => {
        if ((typeof i === 'string' && i) || i.association) {
          return true;
        }
        return false;
      })
      .map(i => {
        if (typeof i === 'string') {
          i = {
            association: i,
          };
        }

        const rt = {};
        rt.association = i.association;

        if (i.where) {
          rt.where = this.where_check(i.where, true);
          if (!rt.where || Object.keys(rt.where).length === 0) delete rt.where;
        }

        if (i.attributes) {
          rt.attributes = this.attributes_check(i.attributes);
          if (rt.attributes.length === 0) delete rt.attributes;
        }

        if (typeof i.required === 'boolean') rt.required = true;
        return rt;
      });
    if (include.length > 0) option.include = include;
    where = this.where_check(where);

    option.where = {
      ...(where || {}),
      ...this.ctx.where,
    };

    if (Object.keys(option.where).length === 0) delete option.where;
    if (option.include) option.distinct = true;
    return option;
  }

  async index() {
    const option = this.build_sql_option();
    if (option.pager) {
      this.ctx.body = await this.model.findAndCountAll({
        ...option,
      });
    } else {
      this.ctx.body = await this.model.findAll({
        ...option,
      });
    }
  }

  async show() {
    const option = this.build_sql_option();
    let include = [];
    if (option.include) include = option.include;
    this.ctx.body = await this.model.findOne({
      where: {
        id: this.ctx.params.id,
        ...this.ctx.where,
      },
      include,
    });
  }

  async create() {
    const { links = [] } = this.ctx.queries;
    const data = this.ctx.request.body;

    for (const key in this.ctx.where) {
      if (this.is_attribute(key)) {
        data[key] = this.ctx.where[key];
      }
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
    const instance = await await this.model.findOne({
      where: {
        id: this.ctx.params.id,
        ...this.ctx.where,
      },
    });

    if (instance) {
      this.ctx.body = await instance.update(this.ctx.request.body);
      for (const link of links) {
        if (
          instance[`set${link}`] &&
          this.ctx.request.body[link.toLowerCase()]
        ) {
          await instance[`set${link}`]([]);
          await instance[`set${link}`](
            this.ctx.request.body[link.toLowerCase()]
          );
        }
      }
    }
  }

  async destroy() {
    this.ctx.body = await this.model.destroy({
      where: { id: this.ctx.params.id, ...this.ctx.where },
    });
  }

  is_attribute(attribute) {
    if (!this[CURRENTMODELINITED]) {
      this[CURRENTMODELINITED] = new this.model();
    }
    return this[CURRENTMODELINITED]._isAttribute(attribute);
  }
}

module.exports = CurdService;
