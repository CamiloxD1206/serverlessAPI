"use strict";
const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();
const { v4: uuidv4 } = require("uuid");
const ssm = new AWS.SSM();
const cognitoProvider = new AWS.CognitoIdentityServiceProvider();

module.exports.hello = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Bienvenido a mi API",
    }),
  };

  return callback(null, response);
};

module.exports.authorize = async (event, context, callback) => {
  const token = event.headers.Authorization;
  const tokenDev=process.env.TOKEN_DEV
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Token de autorización no proporcionado" }),
    };
  }
  if (
    token !== tokenDev) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Token de autorización inválido" }),
    };
  }
  return null;
};
//register------------------------------------------------------------------
module.exports.createUser = async (event, context, callback) => {
  const body = JSON.parse(event.body);
  try {
    const id = uuidv4();
    const dynamoParams = {
      TableName: "UsersTable",
      Item: {
        id: id,
        correo: body.correo,
        password: body.contraseña,
      },
    };
    await dynamodb.put(dynamoParams).promise();

    const cognitoParams = {
      UserPoolId: "us-east-1_fz9ot54FN", 
      Username: body.correo,
      Password: body.contraseña
    };
    const cognitoResponse = await cognitoProvider.adminCreateUser(cognitoParams).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Usuario creado correctamente. Por favor, inicia sesión y cambia tu contraseña para continuar",
        userId: id,
      }),
    };
  } catch (error) {
    console.error("Error al crear usuario", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Ocurrió un error al crear usuario",
      }),
    };
  }
};

//login-------------------------------------------------------------
module.exports.login = async (event, context, callback) => {
  const body = JSON.parse(event.body);
  try {
    const authParams = {
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      UserPoolId: "us-east-1_fz9ot54FN",
      ClientId: "19vtl6pqe6detnupu4vrtde3i2",
      AuthParameters: {
        USERNAME: body.correo,
        PASSWORD: body.contraseña,
      }
    };
    const authResponse = await cognitoProvider.adminInitiateAuth(authParams).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Inicio de sesión exitoso",
        accessToken: authResponse.AuthenticationResult.AccessToken,
      }),
    };
  } catch (error) {
    console.error("Error al iniciar sesión", error);
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: "Credenciales inválidas. Por favor, verifica tu usuario y contraseña e intenta nuevamente.",error
      }),
    };
  }
};




// Métodos de mi API------------------------------------------------
module.exports.getAllUsers = async (event, context, callback) => {
  const authorizationResult = await module.exports.authorize(
    event,
    context,
    callback
  );
  if (authorizationResult) {
    return authorizationResult;
  }

  const params = {
    TableName: "UsersTable",
  };

  try {
    const result = await dynamodb.scan(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error("Error al obtener usuarios", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Ocurrió un error al obtener usuarios",
      }),
    };
  }
};

module.exports.getUserById = async (event, context, callback) => {
  const authorizationResult = await module.exports.authorize(
    event,
    context,
    callback
  );
  if (authorizationResult) {
    return authorizationResult;
  }

  const { id } = event.pathParameters;

  const params = {
    TableName: "UsersTable",
    Key: {
      id: id,
    },
  };

  try {
    const result = await dynamodb.get(params).promise();
    if (result.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Usuario no encontrado" }),
      };
    }
  } catch (error) {
    console.error("Error al obtener usuario", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Ocurrió un error al obtener usuario",
      }),
    };
  }
};

module.exports.deleteUser = async (event, context, callback) => {
  const authorizationResult = await module.exports.authorize(
    event,
    context,
    callback
  );
  if (authorizationResult) {
    return authorizationResult;
  }

  const { id } = event.pathParameters;

  const params = {
    TableName: "UsersTable",
    Key: {
      id: id,
    },
  };

  try {
    await dynamodb.delete(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Usuario eliminado exitosamente",
      }),
    };
  } catch (error) {
    console.error("Error al eliminar usuario", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Ocurrió un error al eliminar usuario",
      }),
    };
  }
};

module.exports.updateUser = async (event, context, callback) => {
  const authorizationResult = await module.exports.authorize(
    event,
    context,
    callback
  );
  if (authorizationResult) {
    return authorizationResult;
  }

  const { id } = event.pathParameters;
  const body = JSON.parse(event.body);

  const params = {
    TableName: "UsersTable",
    Key: {
      id: id,
    },
    UpdateExpression: "set correo = :correo, contraseña = :contraseña",
    ExpressionAttributeValues: {
      ":correo": body.correo,
      ":contraseña": body.contraseña,
    },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    const result = await dynamodb.update(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Usuario actualizado exitosamente",
        updatedAttributes: result.Attributes,
      }),
    };
  } catch (error) {
    console.error("Error al actualizar usuario", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Ocurrió un error al actualizar usuario",
      }),
    };
  }
};

// SNS------------------------------------------------

module.exports.snsRequest = async (event) => {
  try {
    const mensaje = JSON.parse(event.body).mensaje;
    const arn = process.env.SNS_ARN;
    const params = {
      Message: mensaje,
      TopicArn: arn,
    };
    await sns.publish(params).promise();
    console.log("Mensaje enviado a SNS");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Mensaje enviado a SNS correctamente",event })
      
    };
  } catch (error) {
    console.error("Error al enviar mensaje a SNS", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al enviar mensaje a SNS" })
    };
  }
};