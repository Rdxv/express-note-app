import express from 'express';
import logMiddleware from "../middlewares/log.middleware.js";
import authMiddleware from '../middlewares/auth.middleware.js';
import * as core from "../services/core.service.js";
import {v4 as generateUUID} from 'uuid';
import {saveNotes, importNotes} from '../services/note.service.js';
import {param, query, validationResult} from 'express-validator';

const notesRoute = express.Router(); 

/* 
Si ringrazia Simone Oliva per il contributo dato sulla gestione delle rotte con la data e il limite di note, tuttavia ho il suo stesso problema, il path /api/notes
mi ritorna tutte le note. Si deve usare il path /api/notes/date o /limit
*/

// Inizializza la lista delle note con i dati del file json
notesRoute.get('/initialize', logMiddleware,(req, res) => 
{
    try
    {
        core.importNotes();
    }
    catch(error)
    {
        console.log(error)
        res.status(500)
        .json
        ({
            "error" : error,
        })
    }
})

// Read: Restituisce tutte le note
notesRoute.route('/api/notes').get(logMiddleware, async (req, res) => 
    {
            
            res.status(200).json
            ({
                "success" : true,
                "list" : true,
                "data": importNotes()
            })
        })
        // Create: Crea una nuova nota
    .post(authMiddleware, logMiddleware,(req, res) => 
    {
        // generateUUID consente di generare un UUID al momento della creazione. E' stato preso da https://www.npmjs.com/package/uuid
        let newUUID = generateUUID()
        let newUser = req.body.user;
        let newDate = req.body.date;
        let newTitle = req.body.title;
        let newBody = req.body.body;
        let structNote = 
        {
            // crea nuovo oggetto nota
            "id": newUUID,
            "user" : newUser,
            "date" : newDate,
            "title" : newTitle,
            "body" : newBody
        }
    
        let notesList = importNotes()
        
        // Inserisce la nuova nota in fondo alla lista
        notesList.push(structNote)
        
        // Salva la lista aggiornata
        saveNotes(notesList)
    
        // nella risposta mostra la nuova nota creata e il codice 201
        res.status(201).json
        ({
            "id": newUUID,
            "user" : newUser,
            "date" : newDate,
            "title" : newTitle,
            "body" : newBody
        })
    })

    // Read: cerca una nota, prendendo lo UUID dalla request. Importante: scrivere lo UUID subito dopo lo / senza mettere i :
notesRoute.route('/api/notes/:uuid').get(param('uuid').isLength({min: 36, max:36}), logMiddleware,(req, res) => // controlla la lunghezza dell'uuid
    {
        let uuid = req.params.uuid;
        const error = validationResult(req); // verifica errori nei parametri passatti nella richiesta
        let notesList = importNotes();
        if(!error.isEmpty())
        { // Se express-validator trova un errore, ritorna una bad request
            res.status(400).json
            ({
                success: false,
                error: error.array()
            })
        } 
        res.status(200)
            .json({
            "success" : true,
            "single" : true,
            "data" : notesList.filter(note => note.id === uuid)
        });
    })
    
    // Update: Modifica una nota
    .put(param('uuid').isLength({min: 36, max:36}), authMiddleware, logMiddleware,(req, res) => 
    {

        let notesList = importNotes();

        let uuid = req.params.uuid;
        let title = req.body.title;
        let body = req.body.body;

        // memorizza i dati della nota che si sta modificando, li recupera cercando l'uuid corrispondente
        let selectedNote = notesList.find(note => note.id === uuid)

        const error = validationResult(req); 
        if(!error.isEmpty())
        {
            res.status(400).json
            ({
                success: false,
                error: error.array()
            })
        }
        
        let modifiedNote;
    
        // errore se si cerca di modificare una nota che non esiste
        if(selectedNote === undefined)
        {
            res.status(404).json
            ({
                "success" : false,
                "error": "Note does not exist" 
            })
        }
        else
        {
            modifiedNote = 
            {
                "id": uuid,
                "user" : selectedNote.user,
                "date" : selectedNote.date,
                "title" : title,
                "body" : body,
                "created_at": selectedNote.created_at
            }
        }
        // la nota da modificare viene rimossa dalla lista delle altre note
        let modifiedNoteList = notesList.filter( note => note.id !== uuid); 
        // la nota modificata viene aggiunta alla lista delle altre note
        modifiedNoteList.push(modifiedNote);
        saveNotes(modifiedNoteList)
        res.status(200).json
        ({
            "title" : modifiedNote.title,
            "body": modifiedNote.body
        })
    
    })

    // Read: recupera le note con una data successiva a quella passata nell'URL
    // Usato il metodo trim per rimuovere gli spazi iniziali e finali
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim
notesRoute.get('/api/notes/date',query('date').trim().isDate(), authMiddleware, logMiddleware, (req, res) => 
    {
        let urlDate = req.query.date;
        console.log("Notes created after this date: ",urlDate);
        let filterByDate = importNotes().filter(note => new Date(note.date) > new Date(urlDate))
        console.log()
        const error = validationResult(req);
        if(!error.isEmpty())
        { // Errore bad request se la data non è valida
            res.status(400).json
            ({
                success: false,
                error: error.array()
            })
        }
        res.status(200).json
        ({
            "success" : true,
            "filtered" : true,
            "data" : [filterByDate]
        })
    })


notesRoute.get('/api/notes/limit',query('limit').isNumeric(), authMiddleware, logMiddleware, (req, res) =>
    {
        const error = validationResult(req);
            if(!error.isEmpty())
            {
                res.status(400).json
                ({
                    success: false,
                    error: error.array()
                })
            }
        let limit = req.query.limit;
        console.log("Amount of notes, ordered by most recent: ", limit)
        let notesByDate = importNotes().sort((a,b) =>
        {
            // ordina le note in ordine decrescente. preso da: https://www.codegrepper.com/code-examples/javascript/
            //                                                 sort+of+array+in+descending+order+in+nodejs
            new Date(b.date) - new Date(a.date) 
        });
        res.status(200).json
        ({
            success: true,
            // lascia solo il numero di note richiesto. Fonte: https://developer.mozilla.org/en-US/docs/Web/JavaScript/
            //                                                 Reference/Global_Objects/Array/slice?retiredLocale=it
            data : notesByDate.slice(-limit) 
        })
    })

export default notesRoute;