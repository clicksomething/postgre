const glpkInit = require('glpk.js');

async function testSimpleGLPK() {
  try {
    console.log('Initializing GLPK...');
    const glpk = await glpkInit();
    console.log('GLPK initialized successfully');
    
    // Create a simple test model
    const model = {
      name: 'SimpleTest',
      objective: {
        direction: 1, // maximize
        name: 'obj',
        vars: [
          { name: 'x1', coef: 1 },
          { name: 'x2', coef: 1 }
        ]
      },
      subjectTo: [
        {
          name: 'c1',
          vars: [
            { name: 'x1', coef: 1 },
            { name: 'x2', coef: 1 }
          ],
          bnds: { type: 2, ub: 1 } // 2 = upper bound
        }
      ],
      binaries: ['x1', 'x2'],
      generals: [],
      options: {
        msglev: 3,
        tmlim: 10000
      }
    };
    
    console.log('Model:', JSON.stringify(model, null, 2));
    
    console.log('Solving...');
    const result = glpk.solve(model);
    console.log('Result:', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSimpleGLPK(); 