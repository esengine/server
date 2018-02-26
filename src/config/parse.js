// parse.js
// Reads an schema and retrieves the proper options from it

// Errors specifics to this submodule
const OptionsError = require('./errors');
const path = require('path');


// The main function.
// - arg: user options from the argument in the main server() function
// - env: the environment variables as read from env.js
// - parent: if it's a submodule, the global configuration
const parse = module.exports = async (schema, ...args) => {

  // For plugins, accept "false" to nuke a full plugin
  if (args.includes(false)) {
    return false;
  }

  // Clean them and put them into their names
  const [env = {}, arg = {}, parent = {}] = args.map((dirty = {}) => {

    // Accepts a single option instead of an object and it will be mapped to its
    // root value. Example: server(2000) === server({ port: 2000 })
    if (typeof dirty !== 'object') {
      if (!schema.__root) {
        throw new OptionsError('notobject');
      }
      if (typeof schema.__root !== 'string') {
        throw new OptionsError('rootnotstring');
      }
      dirty = { [schema.__root.toLowerCase()]: dirty };
    }

    // Clone them to remove the references
    let opts = {};

    // Loop and assign them with lowercase. Everything should be lowercase:
    for (const key in dirty) {
      opts[key.toLowerCase()] = dirty[key];
    }

    return opts;
  });



  // Fully parsed options will be stored here
  const options = {};

  // Loop each of the defined options
  for (let name in schema) {

    // RETRIEVAL
    // Make the definition local so it's easier to handle
    const def = schema[name];
    let value;

    // Skip the control variables such as '__root'
    if (/^__/.test(name)) continue;

    // Make sure we are dealing with a valid schema definition for this option
    if (typeof def !== 'object') {
      throw new OptionsError('noobjectdef', { name, type: typeof def });
    }

    // The user defined a function to find the actual value manually
    if (def.find) {
      value = await def.find({ arg, env, def, parent, schema });
    } else {

      // Use the user-passed option unles explictly told not to
      if (def.arg !== false) {
        def.arg = def.arg === true ? name : def.arg || name;
      } else if (arg[name] && env.node_env === 'test') {
        throw new OptionsError('noarg', { name });
      }

      // Use the environment variable unless explicitly told not to
      if (def.env !== false) {
        def.env = (def.env === true ? name : def.env || name).toLowerCase();
      } else if (env[name] && env.node_env === 'test') {
        throw new OptionsError('noenv', { name });
      }

      // Make sure to use the name if we are inheriting with true
      if (def.inherit !== false) {
        def.inherit = (def.inherit === true ? name : def.inherit || name);
      }

      // List of possibilities, from HIGHER preference to LOWER preference
      // Removes the empty one and gets the first one as it has HIGHER preference
      const possible = [
        env[def.env],
        arg[def.arg],
        parent[def.inherit],
        def.default
      ].filter(value => typeof value !== 'undefined');
      if (possible.length) {
        value = possible[0];
      }
    }

    // Extend the base object or user object with new values if these are not set
    if (def.extend && typeof value === 'object') {
      value = Object.assign({}, def.default || {}, value);
    }

    // Normalize the "public" folder or file
    if ((def.file || def.folder) && typeof value === 'string') {
      if (!path.isAbsolute(value)) {
        value = path.join(process.cwd(), value);
      }
      value = path.normalize(value);
      if (def.folder && value[value.length - 1] !== path.sep) {
        value = value + path.sep;
      }
    }

    // A final hook for the schema to call up on the value
    if (def.clean) {
      value = await def.clean(value, { arg, env, parent, def, schema });
    }




    // VALIDATION
    // Validate that it is set
    if (def.required && typeof value === 'undefined') {
      throw new OptionsError('required', { name });

      // TODO: check that the file and folder exist
    }

    if (def.enum && value && !def.enum.includes(value)) {
      throw new OptionsError('enum', { name, value, possible: def.enum });
    }

    // Validate the type (only if there's a value)
    if (def.type && value) {

      // Parse valid types into a simple array of strings: ['string', 'number']
      def.type = (def.type instanceof Array ? def.type : [def.type])
        // pulls up the name for primitives such as String, Number, etc
        .map(one => (one.name ? one.name : one).toLowerCase());

      // Make sure it is one of the valid types
      if (!def.type.includes(typeof value)) {
        throw new OptionsError('type', {
          name, expected: def.type, value
        });
      }
    }

    if (def.validate) {
      let ret = def.validate(value, def, options);
      if (ret instanceof Error) throw ret;
      if (!ret) throw new OptionsError('validate', { name, value });
    }

    if (typeof value !== 'undefined') {
      options[name] = value;
    }
  }

  // If the property 'options' exists handle it recursively
  for (let name in schema) {
    const def = schema[name];
    if (def.options) {
      options[name] = await parse(def.options, env, arg[name], options);
    }
  }

  return options;
};
