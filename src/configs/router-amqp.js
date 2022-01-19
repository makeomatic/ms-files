// make sure we dont reject .process right away
const processRegExp = /\.process$/;
const isProcess = (name) => processRegExp.test(name);

exports.routerAmqp = {
  retry: {
    enabled: true,
    min: 100,
    max: 3000,
    factor: 2,
    maxRetries: 5,
    predicate(error, actionName) {
      switch (error.name) {
        case 'ValidationError':
        case 'HttpStatusError':
          return true;

        default:
          return isProcess(actionName) === false;
      }
    },
  },
};
