class ErrorHandler extends Error{
    constructor(message, statusCode){
        super(message);
        this.statusCode = statusCode;
    }
}

export const errorMiddleware = (err, req, res, next)=>{
    if(!err){
        return res.status(500).json({
            success: false,
            message: 'Unknown error.'
        });
    }
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Internal Server error';

    if(err.name === 'CastError'){
        const message = `Invalid ${err.path}`;
        err = new ErrorHandler(message, 400);
    }
    if(err.name === 'JsonWebTokenError'){
        const message = 'Invalid Web Token.';
        err = new ErrorHandler(message, 400);
    }
    if(err.name === 'TokenExpiredError'){
        const message = 'Token is expired!'
        err = new ErrorHandler(message, 400);
    }
    return res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
}

export default ErrorHandler;