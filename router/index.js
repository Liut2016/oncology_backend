const user = require('./user');
//const patients = require('./patient');
const patients_first = require('./patients_first');
const patients_second = require('./patients_second'); 
const data_init = require('./data_init');
    module.exports = function(app){
    app.use(user.routes()).use(user.allowedMethods());
    //app.use(patients.routes()).use(patients.allowedMethods());
    app.use(patients_first.routes()).use(patients_first.allowedMethods());
    app.use(patients_second.routes()).use(patients_second.allowedMethods());
    app.use(data_init.routes()).use(data_init.allowedMethods());
};