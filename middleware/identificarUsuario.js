import jwt from 'jsonwebtoken'
import Usuario from '../models/Usuario.js'

const identificarUsuario = async (req, res, next) => {
    // Identificar si hay un token
    const {_token} = req.cookies
    if(!_token){
        req.usuario = null
        return next()
    }

    //Comprobar el _token
    try{
        const decoded = jwt.verify(_token, process.env.JWT_SECRET)
        const usuario = await Usuario.scope('eliminarPassword').findByPk(decoded.id)
        // console.log('Usuario logueado:>', usuario.dataValues)

        // Almacenar el usuario al Req
        if(usuario){
            req.usuario = usuario
        }
        return next();
    }catch (error){
        console.log('Error en IdentificarUsuario: ', error)
        return res.clearCookie('_token').redirect('/auth/login')
    }
}

export default identificarUsuario