'use strict';
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS(); 
const { v4: uuidv4 } = require('uuid');

module.exports.hello = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Get inicial de lambda funcional',
    }),
  };

  return callback(null, response);
};

module.exports.createUser = async (event, context, callback) => {
  const body = JSON.parse(event.body);
  const id = uuidv4();
  const params = {
    TableName: 'UsersTable',
    Item: {
      id: id,
      nombre: body.nombre,
      cedula: body.cedula
    }
  };

  try {
    await dynamodb.put(params).promise();
    await module.exports.snsRequest(`Nuevo usuario creado: ${body.nombre}`); 
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Usuario creado exitosamente'
      })
    };
  } catch (error) {
    console.error('Error al crear usuario', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Ocurrió un error al crear usuario'
      })
    };
  }
};

module.exports.getAllUsers = async (event, context, callback) => {
  const params = {
    TableName: 'UsersTable'
  };

  try {
    const result = await dynamodb.scan(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error al obtener usuarios', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Ocurrió un error al obtener usuarios'
      })
    };
  }
};

module.exports.getUserById = async (event, context, callback) => {
  const { id } = event.pathParameters;

  const params = {
    TableName: 'UsersTable',
    Key: {
      id: id
    }
  };

  try {
    const result = await dynamodb.get(params).promise();
    if (result.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify(result.Item)
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }
  } catch (error) {
    console.error('Error al obtener usuario', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Ocurrió un error al obtener usuario'
      })
    };
  }
};

module.exports.deleteUser = async (event, context, callback) => {
  const { id } = event.pathParameters;

  const params = {
    TableName: 'UsersTable',
    Key: {
      id: id
    }
  };

  try {
    await dynamodb.delete(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Usuario eliminado exitosamente'
      })
    };
  } catch (error) {
    console.error('Error al eliminar usuario', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Ocurrió un error al eliminar usuario'
      })
    };
  }
};

module.exports.updateUser = async (event, context, callback) => {
  const { id } = event.pathParameters;
  const body = JSON.parse(event.body);

  const params = {
    TableName: 'UsersTable',
    Key: {
      id: id
    },
    UpdateExpression: 'set nombre = :nombre, cedula = :cedula',
    ExpressionAttributeValues: {
      ':nombre': body.nombre,
      ':cedula': body.cedula
    },
    ReturnValues: 'UPDATED_NEW'
  };

  try {
    const result = await dynamodb.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Usuario actualizado exitosamente',
        updatedAttributes: result.Attributes
      })
    };
  } catch (error) {
    console.error('Error al actualizar usuario', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Ocurrió un error al actualizar usuario'
      })
    };
  }
};

module.exports.snsRequest = async (mensaje) => {
  const params = {
    Message: mensaje,
    TopicArn: 'arn:aws:sns:us-east-1:590183847589:usuario-creado' 
  };

  try {
    await sns.publish(params).promise();
    console.log('Mensaje enviado a SNS');
  } catch (error) {
    console.error('Error al enviar mensaje a SNS', error);
  }
};