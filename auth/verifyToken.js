let jwt = require('jsonwebtoken');
let config = require('./config');

function verifyToken(req, res, next){
    let token = req.cookies.auth;
    if(!token)  return res.status(200).render('signin');

    jwt.verify(token, config.secret, function(err, decoded){
        if(err) return res.status(200).render('signin');

        req.userID = decoded.id;
        req.claim = decoded.claim;
        next();
    });

}

module.exports = verifyToken;   