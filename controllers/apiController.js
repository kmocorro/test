let bodyParser = require('body-parser');

module.exports = function(app){

    // parse out json and make sure app can handle url request
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /** GET API for main page functions */
        /**
         * GET | app render index page.
         */
        app.get('/', function(req, res){
            res.render('index');
        });

        /**
         * GET | app about page.
         */
        app.get('/about', function(req, res){
            res.render('about');
        });

        /**
         * GET | app build guide page.
         */
        app.get('/guide', function(req, res){
            res.render('build_guide');
        });

        /**
         * GET | app build pc page.
         */
        app.get('/setup', function(req, res){
            res.render('build_pc');
        });

        /**
         * GET | app build selection page.
         */
        app.get('/buildapc/buildselection', function(req, res){
            res.render('build_selection');
        });

        /**
         * GET | app disclaimer page.
         */
        app.get('/disclaimer', function(req, res){
            res.render('disclaimer');
        });

        /**
         * GET | app privacy policy page.
         */
        app.get('/privacy-policy', function(req, res){
            res.render('privacy');
        });

        /**
         * GET | app support page.
         */
        app.get('/support', function(req, res){
            res.render('support');
        });

        /**
         * GET | app login page.
         */
        app.get('/login', function(req, res){
            res.render('login');
        });

        /**
         * GET | app register page.
         */
        app.get('/register', function(req, res){
            res.render('register');
        });

    /** END of GET APIs */


}