const user = require('./user');
const note = require('./note');
const blog = require('./blog');
const img = require('./img');
const patients = require('./patient');
const data_init = require('./data_init');
    module.exports = function(app){
    app.use(user.routes()).use(user.allowedMethods());
    app.use(note.routes()).use(note.allowedMethods());
    app.use(blog.routes()).use(blog.allowedMethods());
    app.use(img.routes()).use(img.allowedMethods());
    app.use(patients.routes()).use(patients.allowedMethods());
    app.use(data_init.routes()).use(data_init.allowedMethods());
};