export const getAllTask = (req, res)=>{
    res.status(200).send("Hello");
}

export const createTask = (req, res)=>{
    res.status(201).json({message:"Create successfully!"});
};

export const updateTask = (req, res)=>{
    res.status(200).json({message:"Update successfully!"});
}

export const deleteTask = (req, res)=>{
    res.status(200).json({message:"Detele successfully!"});
}