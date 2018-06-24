let bodyParser = require('body-parser');
let verifyToken = require('../auth/verifyToken');

module.exports = function(app){

    // parse out json and make sure app can handle url request
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /** GET API for main page functions */
        /**
         * GET | app render index page.
         */
        app.get('/', verifyToken, function(req, res){
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');

            if(req.userID && req.claim){

                res.render('index', {firstname: req.claim.firstname || req.claim.given_name});
                //console.log(req.claim);

            } else {

                res.render('signin');
            }

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
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');

            res.send('hey. this is secured. Welcome!');
            
        });

        /**
         * GET | app build pc page.
         */
        app.get('/setup', verifyToken, function(req, res){
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');

            if(req.claim.firstname){

                res.send('hey. this is secured. Welcome ' + req.claim.firstname + '!' );
 
            } else if(req.claim.given_name) {
                res.send('hey. this is secured. Welcome ' + req.claim.given_name + '!' );
            
            } else {
                res.render('setup');
            }
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
        app.get('/privacy', function(req, res){
            res.render('privacy');
        });

        /**
         * GET | app support page.
         */
        app.get('/support', function(req, res){
            res.render('support');
        });

        /**
         * GET | app register page.
         */
        app.get('/signup', function(req, res){
            res.render('signup');
        });

        /**
         * GET | app sign in page
         */
        app.get('/signin', function(req, res){
            res.render('signin');
        });

        /**
         * GET | app forgot password
         */
        app.get('/forgotpassword', function(req, res){
            res.render('forgotpassword');
        });

    /** END of GET APIs */

    
}