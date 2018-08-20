// Parser plugin
// Get the raw request and transform it into something usable
// Examples: ctx.body, ctx.files, etc
const pkg = require('../../packages');

const plugin = {
  name: 'parser',
  options: {
    body: {
      type: [Object, Boolean],
      default: { extended: true },
      extend: true
    },
    json: {
      type: [Object, Boolean],
      default: {}
    },
    text: {
      type: Object,
      default: {}
    },
    data: {
      type: Object,
      default: {}
    },
    cookie: {
      type: Object,
      default: {}
    },
    method: {
      type: [Object, String, Boolean],
      default: [
        'X-HTTP-Method',
        'X-HTTP-Method-Override',
        'X-Method-Override',
        '_method'
      ],
      // Coerce it into an Array if it is not already
      clean: value => typeof value === 'string' ? [value] : value
    }
  },

  before: [
    ctx => {
      if (!ctx.options.parser.method) return;
      return ctx.utils.join(ctx.options.parser.method.map(one => {
        return ctx.utils.modern(pkg.methodOverride(one));
      }))(ctx);
    },

    ctx => {
      if (!ctx.options.parser.body) return;
      const body = pkg.bodyParser.urlencoded(ctx.options.parser.body);
      return ctx.utils.modern(body)(ctx);
    },

    // JSON parser
    ctx => {
      if (!ctx.options.parser.json) return;
      const json = pkg.bodyParser.json(ctx.options.parser.json);
      return ctx.utils.modern(json)(ctx);
    },

    // Text parser
    ctx => {
      if (!ctx.options.parser.text) return;
      const text = pkg.bodyParser.text(ctx.options.parser.text);
      return ctx.utils.modern(text)(ctx);
    },

    // Data parser
    ctx => {
      if (!ctx.options.parser.data) return;
      const data = pkg.expressDataParser(ctx.options.parser.data);
      return ctx.utils.modern(data)(ctx);
    },

    // Cookie parser
    ctx => {
      if (!ctx.options.parser.cookie) return;
      const cookie = pkg.cookieParser(
        ctx.options.secret,
        ctx.options.parser.cookie
      );
      return ctx.utils.modern(cookie)(ctx);
    },

    // Add a reference from ctx.req.body to the ctx.data and an alias
    ctx => {
      ctx.data = ctx.data || ctx.body;
    },
  ]
};

module.exports = plugin;
