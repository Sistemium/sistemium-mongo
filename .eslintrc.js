// https://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  parserOptions: {
  },
  env: {
    // browser: true,
  },
  // https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
  // consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
  extends: ['airbnb-base'],
  // required to lint *.vue files
  plugins: [
    // 'vue'
  ],
  globals: {
    printjson: 'off',
  },
  // check if imports actually resolve
  settings: {
    // 'import/resolver': {
    //   webpack: {
    //     config: 'build/webpack.base.conf.js'
    //   }
    // }
  },
  // add your custom rules here
  rules: {
    // don't require .vue extension when importing
    'import/extensions': ['error', 'always', {
      js: 'never',
      // vue: 'never'
    }],
    // disallow reassignment of function parameters
    // disallow parameter object manipulation except for specific exclusions
    'no-param-reassign': ['error', {
      props: true,
      ignorePropertyModificationsFor: [
        'session', // for context sessions
        'ctx', // for koa routes
        // 'state', // for vuex state
        // 'acc', // for reduce accumulators
        // 'e' // for e.returnvalue
      ]
    }],
    // allow optionalDependencies
    'import/no-extraneous-dependencies': ['error', {
      // optionalDependencies: ['test/unit/index.js']
    }],
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-use-before-define': ['error', { functions: false, classes: true }],
    'padded-blocks': 'off',
    'arrow-parens': ['error', 'as-needed'],
    'no-mixed-operators': 'off',
    'no-multiple-empty-lines': ['error', { max: 2 }],
  }
};
