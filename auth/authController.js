let jwt = require('jsonwebtoken');
let bodyParser = require('body-parser');
let config = require('./config');
let formidable = require('formidable');
let postgresql = require('../db/dbConfig');
let bcrypt = require('bcryptjs');

let nodemailer = require('nodemailer');
let mail = require('../mail/config');

let {OAuth2Client} = require('google-auth-library');
let CLIENT_ID = "120644413442-6km9fnqj8ttublf2392d3nenf5ls7voq.apps.googleusercontent.com";
let client = new OAuth2Client(CLIENT_ID);

let verifyToken = require('./verifyToken');

module.exports = function(app){

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    /** Nodemailer transporter */
    let transporter = nodemailer.createTransport(mail.poolConfig);

    /**
     * GET | app login page.
     */
    app.get('/login', function(req, res){
        res.render('login');
    });
    app.get('/logout', function(req, res){
        res.cookie('auth', null);
        res.redirect('/');
    });

    /** POST API for user sign in validation */
    app.post('/api/oauth2google', function(req, res){

        let id_token = req.body; // id_token need to verify first.

        async function verify(){
            let ticket = await client.verifyIdToken({
                idToken: id_token.idtoken,
                audience: CLIENT_ID,
            });

            let payload = ticket.getPayload(); // payload, contains claims 
            let userid = payload['sub'];
            
            return payload; // AHA! 
        }

        verify().then(function(payload){
            console.log(payload);

            let token = jwt.sign({ id: payload.jti, claim: payload }, config.secret, {expiresIn: 86400});
            res.cookie('auth', token);
            res.status(200).send({auth: true, token: token});

        }).catch(console.error);

    });

    app.post('/api/login', function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields, files){ // parse incoming form
            
            if(fields){
                let form_login_details = fields;

                if(form_login_details.email && form_login_details.password){
                    
                    let selectEmail = {
                        text: 'SELECT * FROM app_manual_signin WHERE email = $1',
                        values: [form_login_details.email]
                    }

                    postgresql.pool.query(selectEmail, function(err, results){
                        if(err){ return res.send({err: 'Error occured while connecting to database'})};

                        if(results.command == 'SELECT'){
                            
                            if(typeof results.rows[0] !== 'undefined' && results.rows[0] !== null){
                                
                                let isPasswordValid = bcrypt.compareSync(form_login_details.password, results.rows[0].encrypted_pw);

                                if(!isPasswordValid){

                                    res.send({err: 'Invalid email or password.'});

                                } else {

                                    let token = jwt.sign({ id: results.rows[0].id }, config.secret, { expiresIn: 86400 });
                                    
                                    res.cookie('auth', token);
                                    res.status(200).send({ auth: 'Authenticated. Please wait...' });
                                }

                            } else {
                                res.send({err: 'Password does not match the email or the account does not exist.' });
                            }
                        } else {

                            res.send({err: 'Invalid query.'});

                        }
                    });
        
                } else {
                    res.send({err: 'Invalid email or password.'});
                }
            }

        });

    });

    app.post('/api/register', function(req, res){

        let form = new formidable.IncomingForm();

        form.parse(req, function(err, fields){

            if(fields){

                let form_register_details = fields;

                let hashedBrown = bcrypt.hashSync(form_register_details.password);

                /** QUERY INSERT TO POSTGRESQL */
                let insert_form_register_details = { 
                    text: 'INSERT INTO app_manual_signin (email, signin, name, givenname, lastname, encrypted_pw) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    values: [form_register_details.email, new Date(), form_register_details.firstname + ' ' + form_register_details.lastname, form_register_details.firstname, form_register_details.lastname, hashedBrown]
                }

                let token = jwt.sign({ id: form_register_details.email }, config.secret, { expiresIn: 360 });

                /** SETUP MAIL */
                let mailOptions = {
                    from: '"PCBuilderApp" <admin@pcbuilder.app>', //sender
                    to: form_register_details.email,
                    subject: 'Verify Email Address for PCBuilderApp',
                    html: '<p>Hey ' + form_register_details.firstname + ', <br><br> Thanks for registering for an account on PCBuilderApp! <br>Before we get started, we just need to confirm that this is you. <br><br>Click below to verify your email address: <br><br><a href="http://localhost:7007/verifysignup?token=' + token + '">http://localhost:7007/verifysignup?token=' + token + '</a>. <br><br> Have fun PC Builders! </p>'
                };

                transporter.sendMail(mailOptions, function(error, info){
                    if(error){ return console.log(error)};
                    console.log('Message sent: ' + info.response);
                });

                /**
                postgresql.pool.query(insert_form_register_details, function(err, results){ // single transaction
                    if(err){ return res.send({err: 'Error occured while connecting to database.'})};
                    
                    if(results.command == 'INSERT'){

                        res.status(200).send({auth: 'Successfully signed up. Redirecting...'});

                    } else {

                        res.send({err: 'Error occured while inserting to database.' });

                    }

                });
                */

            }

        });

    });

    app.post('/api/forgotpassword', function(req, res){
        console.log(req.body.email);
    });


}