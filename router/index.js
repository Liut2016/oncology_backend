const user = require('./user');
const patients = require('./patient');
const data_init = require('./data_init');
    module.exports = function(app){
    app.use(user.routes()).use(user.allowedMethods());
    app.use(patients.routes()).use(patients.allowedMethods());
    app.use(data_init.routes()).use(data_init.allowedMethods());
};