import { unlink } from 'node:fs/promises'
import { validationResult } from 'express-validator'
import { Precio, Categoria, Propiedad, Mensaje, Usuario} from '../models/index.js'
import { esVendedor, formatearFecha } from '../helpers/index.js'

const admin = async (req, res) =>{

    // Leer QueryString
    const { pagina : paginaActual } = req.query

    const expresion = /^[1-9]$/

    if(!expresion.test(paginaActual)){
        return res.redirect('/mis-propiedades?pagina=1')
    }

    try {

        const { id } = req.usuario

        // Limites y Offset para el paginador 
        const limit = 10;
        const offset = ((paginaActual * limit) - limit)  // igual que un skip

        const [propiedades, total] = await Promise.all([
            Propiedad.findAll({
                limit: limit,
                offset: offset,
                where:{
                    usuarioId : id
                },
                include: [
                    { model: Categoria, as: 'categoria' },
                    { model: Precio, as: 'precio' },
                    { model: Mensaje, as: 'mensajes' }
                ]
            }),
            Propiedad.count({
                where: {
                    usuarioId : id
                }
            })
        ])


    
        res.render('propiedades/admin', {
            pagina:'Mis Propiedades',
            propiedades,
            csrfToken: req.csrfToken(),
            paginas: Math.ceil(total / limit),
            paginaActual: Number(paginaActual),
            total,
            offset,
            limit
        })
        
    } catch (error) {
        console.log(error)
    }


}
// Formulario para crear una propiedad
const crear = async (req, res)=>{

    // Consultar modelo de precio y categorias
    const [categorias, precios] = await Promise.all([
        Categoria.findAll(),
        Precio.findAll()
    ])
    res.render('propiedades/crear', {
        pagina: 'Crear Propiedad',
        csrfToken: req.csrfToken(),
        categorias,
        precios,
        datos: {}
    })
}

const guardar = async (req, res) => {

    // Validacion
    let resultado = validationResult(req)

    if(!resultado.isEmpty()) {

        // Consultar Modelo de Precio y Categorias
        const [categorias, precios] = await Promise.all([
            Categoria.findAll(),
            Precio.findAll()
        ])

        return res.render('propiedades/crear', {
            pagina: 'Crear Propiedad',
            csrfToken: req.csrfToken(),
            categorias,
            precios, 
            errores: resultado.array(),
            datos: req.body
        })
    }
    
    // Crear un registro
    const { titulo, descripcion, habitaciones, estacionamiento, wc, calle, lat, lng, precio: precioId, categoria: categoriaId } = req.body
    
    const { id: usuarioId } = req.usuario

    try{
        const propiedadGuardada = await Propiedad.create({
            titulo,
            descripcion,
            habitaciones, 
            estacionamiento, 
            wc,
            calle,
            lat,
            lng,
            precioId,
            categoriaId,
            usuarioId,
            imagen: ''
        })

        // console.log('PROPIEDAD ->',propiedadGuardada)
        const {id} = propiedadGuardada

        res.redirect(`/propiedades/agregar-imagen/${id}`)
    }catch{
        console.log(error)
    }
}

const agregarImagen = async (req, res) => {

    const { id } = req.params
    
    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)
    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }
    
    // Validar que la propiedad no este publicada
    if(propiedad.publicada){
        return res.redirect('/mis-propiedades')
    }
    
    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    res.render('propiedades/agregar-imagen', {
        pagina: `Agregar Imagen: ${propiedad.titulo}`,
        csrfToken: req.csrfToken(),
        propiedad,
    })
}

const almacenarImagen = async (req, res, next) => {
    const { id } = req.params
    
    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)
    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }
    
    // Validar que la propiedad no este publicada
    if(propiedad.publicado){
        return res.redirect('/mis-propiedades')
    }
    
    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    try{
        // console.log(req.file)
        // Almacenar la imagen y public propiedad
        propiedad.imagen = req.file.filename
        propiedad.publicado = 1

        await propiedad.save()

        // Continua al siguiente middleware redireccion
        next()  
        // res.redirect('/mis-propiedade') NO SIRVE 
    }catch(err){
        console.log(err)
    }
}

const editar = async (req, res) => {

    const { id } = req.params

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)
    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }

    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    // Consultar modelo de precio y categorias
    const [categorias, precios] = await Promise.all([
        Categoria.findAll(),
        Precio.findAll()
    ])
    res.render('propiedades/editar', {
        pagina: `Editar Propiedad ${propiedad.titulo}`,
        csrfToken: req.csrfToken(),
        categorias,
        precios,
        datos: propiedad
    })
}


const guardarCambios = async (req, res) => {

    // Validacion
    let resultado = validationResult(req)    

    if(!resultado.isEmpty()) {

        // Consultar Modelo de Precio y Categorias
        const [categorias, precios] = await Promise.all([
            Categoria.findAll(),
            Precio.findAll()
        ])

        return res.render('propiedades/editar', {
            pagina: 'Editar Propiedad',
            csrfToken: req.csrfToken(),
            categorias,
            precios,
            errores: resultado.array(),
            datos: req.body
        })
    }

    const { id } = req.params

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)

    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }

    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    try {
        // Crear un registro
        const { titulo, descripcion, habitaciones, estacionamiento, wc, calle, lat, lng, precio: precioId, categoria: categoriaId } = req.body

        propiedad.set({
            titulo,
            descripcion,
            habitaciones,
            estacionamiento,
            wc,
            calle,
            lat,
            lng,
            precioId,
            categoriaId
        })

        await propiedad.save();
        
        res.redirect('/mis-propiedades')

    } catch (error) {
        console.log('ERROR [guardarCambios] :', error)
    }
}


const eliminar = async (req, res) => {
    const { id } = req.params

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)

    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }

    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    // Eliminar la imagen
    await unlink(`public/uploads/${propiedad.imagen}`)

    // Eliminar Propiedad
    await propiedad.destroy()
    res.redirect('/mis-propiedades')
}

// Modificar el estado de la propiedad

const cambiarEstado = async (req, res) =>{
    const { id } = req.params

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)

    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }

    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    // Actualizar
    propiedad.publicado = !propiedad.publicado

    await propiedad.save()

    res.json({
        resultado: true
    })
    
}

// Muestra una propiedad 

const mostrarPropiedad = async (req, res) =>{
    
    const { id } = req.params
    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id,{
        include : [
            { model: Precio, as: 'precio' },
            { model: Categoria, as: 'categoria' },
        ]
    })

    if( !propiedad || !propiedad.publicada ){
        return res.redirect('/404')
    }

    // console.log('Mostrar Propiedad ->', esVendedor(req.usuario?.id, propiedad.usuarioId))

    res.render('propiedades/mostrar',{
        propiedad,
        pagina: propiedad.titulo,
        csrfToken: req.csrfToken(),
        usuario: req.usuario,
        esVendedor: esVendedor(req.usuario?.id, propiedad.usuarioId)
    })
}

const enviarMensaje = async (req, res) =>{
    const { id } = req.params
    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id,{
        include : [
            { model: Precio, as: 'precio' },
            { model: Categoria, as: 'categoria' },
        ]
    }
        )
    if( !propiedad ){
        return res.redirect('/404')
    }

    // renderizar los errores

    // Validacion
    let resultado = validationResult(req)

    if(!resultado.isEmpty()) {

        return res.render('propiedades/mostrar',{
            propiedad,
            pagina: propiedad.titulo,
            csrfToken: req.csrfToken(),
            usuario: req.usuario,
            esVendedor: esVendedor(req.usuario?.id, propiedad.usuarioId),
            errores: resultado.array()
        })
    }

    const { mensaje } = req.body
    const { id: propiedadId } = req.params
    const { id: usuarioId } = req.usuario

    // Almacenar mensaje
    await Mensaje.create({
        mensaje,
        propiedadId,
        usuarioId
    })

    // return res.render('propiedades/mostrar',{
    //     propiedad,
    //     pagina: propiedad.titulo,
    //     csrfToken: req.csrfToken(),
    //     usuario: req.usuario,
    //     esVendedor: esVendedor(req.usuario?.id, propiedad.usuarioId),
    //     enviado: true
    // })

    res.redirect('/')

}

// Leer mensajes recibidos
const verMensajes = async (req, res) => {

    const { id } = req.params

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id, {
        include: [
            { model: Mensaje, as: 'mensajes', 
                include:[
                    {model: Usuario.scope('eliminarPassword'), as: 'usuario'}
                ]
             }
        ]
    })

    if( !propiedad ){
        return res.redirect('/mis-propiedades')
    }

    // Validar que la propiedad pertenece a quien visite esta pagina
    if(req.usuario.id.toString() !== propiedad.usuarioId.toString()){
        return res.redirect('/mis-propiedades')
    }

    res.render('propiedades/mensajes',{
        pagina:'Mensajes',
        mensajes: propiedad.mensajes,
        formatearFecha
    })
}

export{
    admin,
    crear,
    guardar,
    agregarImagen,
    almacenarImagen,
    editar,
    guardarCambios,
    eliminar,
    cambiarEstado,
    mostrarPropiedad,
    enviarMensaje,
    verMensajes
}