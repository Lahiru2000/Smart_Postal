import React, { useState, useEffect } from 'react';
import { Package, MapPin, User, Upload, Save, ArrowLeft, Camera, X, AlertCircle, Info, Lock } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const EditShipment = () => {
  const { id } = useParams(); // Start by assuming we're editing a specific shipment ID

  // Mock initial data - In a real app, you'd fetch this using the ID
  const [shipment, setShipment] = useState({
    id: 'SHP-1024',
    status: 'In Transit',
    sender: { name: 'John Doe', phone: '+94 77 123 4567', address: '123 Main St, Colombo' },
    receiver: { name: 'Jane Smith', phone: '+94 71 987 6543', address: '456 Oak Ave, Kandy' },
    package: { weight: '2.5', type: 'Electronics', description: 'Laptop and charger' },
    verification: {
      method: 'Neighbor', // Could be 'Owner', 'Neighbor', 'FrontDoor'
      image: null // null implies no image was added initially
    }
  });

  const [newImage, setNewImage] = useState(null);
  const [error, setError] = useState('');

  // Determine if image upload is allowed
  // Rule: Can add ONLY if method is 'Neighbor' OR if no image exists yet.
  // Rule: Cannot replace existing image.
  const canAddImage = (shipment.verification.method === 'Neighbor' || !shipment.verification.image) && !shipment.verification.image;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation
      if (file.size > 5 * 1024 * 1024) {
        setError('File size too large. Max 5MB.');
        return;
      }
      setNewImage(URL.createObjectURL(file));
      setError('');
    }
  };

  const removeNewImage = () => {
    setNewImage(null);
    setError('');
  };

  const handleSave = () => {
    // Logic to save the new image to the backend would go here
    console.log("Saving new verification image:", newImage);
    alert("Order updated successfully!");
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link to="/dashboard" className="p-2 bg-[#1A1A1A] rounded-xl hover:bg-[#333333] transition-colors border border-[#333333]">
                <ArrowLeft size={20} className="text-gray-400" />
              </Link>
              <h1 className="text-3xl font-bold text-white tracking-tight">Edit Order <span className="text-[#FFC000]">{shipment.id}</span></h1>
            </div>
            <p className="text-gray-400 ml-12">View details and update delivery verification.</p>
          </div>
          <div className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border ${
            shipment.status === 'In Transit' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-800 text-gray-400'
          }`}>
            {shipment.status}
          </div>
        </div>

        <div className="grid gap-8">
          
          {/* Locked Details Section */}
          <div className="bg-[#1A1A1A] rounded-[2rem] p-8 border border-[#333333] relative overflow-hidden">
             {/* Read-Only Overlay/Banner */}
             <div className="absolute top-0 right-0 bg-[#333333] text-gray-400 text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
                <Lock size={10} /> CORE DETAILS LOCKED
             </div>

             <div className="grid md:grid-cols-2 gap-8 opacity-75">
                {/* Sender */}
                <div>
                   <h3 className="text-[#FFC000] font-bold mb-4 flex items-center gap-2">
                      <User size={18} /> Sender
                   </h3>
                   <div className="space-y-2 text-sm text-gray-300">
                      <p><span className="text-gray-500 block text-xs uppercase font-bold">Name</span> {shipment.sender.name}</p>
                      <p><span className="text-gray-500 block text-xs uppercase font-bold">Phone</span> {shipment.sender.phone}</p>
                      <p><span className="text-gray-500 block text-xs uppercase font-bold">Address</span> {shipment.sender.address}</p>
                   </div>
                </div>

                {/* Receiver */}
                 <div>
                   <h3 className="text-[#FFC000] font-bold mb-4 flex items-center gap-2">
                      <MapPin size={18} /> Receiver
                   </h3>
                   <div className="space-y-2 text-sm text-gray-300">
                      <p><span className="text-gray-500 block text-xs uppercase font-bold">Name</span> {shipment.receiver.name}</p>
                      <p><span className="text-gray-500 block text-xs uppercase font-bold">Phone</span> {shipment.receiver.phone}</p>
                      <p><span className="text-gray-500 block text-xs uppercase font-bold">Address</span> {shipment.receiver.address}</p>
                   </div>
                </div>

                {/* Package */}
                 <div className="md:col-span-2 pt-6 border-t border-[#333333]">
                   <h3 className="text-[#FFC000] font-bold mb-4 flex items-center gap-2">
                      <Package size={18} /> Package Details
                   </h3>
                   <div className="grid grid-cols-3 gap-4 text-sm text-gray-300">
                      <div><span className="text-gray-500 block text-xs uppercase font-bold">Type</span> {shipment.package.type}</div>
                      <div><span className="text-gray-500 block text-xs uppercase font-bold">Weight</span> {shipment.package.weight} kg</div>
                      <div><span className="text-gray-500 block text-xs uppercase font-bold">Content</span> {shipment.package.description}</div>
                   </div>
                </div>
             </div>
          </div>

          {/* Verification Section - The Editable Part */}
          <div className="bg-[#1A1A1A] rounded-[2rem] p-8 border border-[#333333] shadow-2xl">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#FFC000] rounded-lg text-black"><Camera size={24} /></div>
              Delivery Verification
            </h2>

            <div className="bg-black/40 rounded-xl p-6 border border-[#333333] mb-6">
               <div className="flex items-start gap-3">
                  <Info className="text-[#FFC000] flex-shrink-0 mt-1" size={20} />
                  <div>
                     <p className="text-gray-300 text-sm leading-relaxed mb-2">
                        <strong>Current Method:</strong> {shipment.verification.method}
                     </p>
                     <p className="text-gray-500 text-xs">
                        Delivery verification helps our drivers identify the correct recipient. Images can be added for neighbors or if one was missed during booking.
                     </p>
                  </div>
               </div>
            </div>

            {/* Existing Image Display */}
            {shipment.verification.image && (
                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Current Verification Image</label>
                    <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden border border-[#333333] group">
                         <img src={shipment.verification.image} alt="Current Verification" className="w-full h-full object-cover opacity-70" />
                         <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-gray-400">
                            <Lock size={32} className="mb-2" />
                            <span className="text-sm font-bold uppercase tracking-widest">Image Locked</span>
                            <span className="text-xs">Cannot replace existing verification image</span>
                         </div>
                    </div>
                </div>
            )}

            {/* New Image Upload Area */}
            {canAddImage ? (
                <div>
                   <label className="text-xs font-bold text-[#FFC000] uppercase tracking-wider mb-2 block flex items-center gap-2">
                      <Upload size={14} /> Add Verification Image
                   </label>
                   
                   {!newImage ? (
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-[#333333] border-dashed rounded-2xl cursor-pointer bg-black hover:border-[#FFC000] hover:bg-[#FFC000]/5 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-4 bg-[#1A1A1A] rounded-full mb-3 group-hover:scale-110 transition-transform">
                            <Camera className="w-8 h-8 text-gray-400 group-hover:text-[#FFC000]" />
                        </div>
                        <p className="mb-2 text-sm text-gray-400"><span className="font-bold text-[#FFC000]">Click to upload photo</span></p>
                        <p className="text-xs text-gray-500">Neighbor or Location Photo (Max 5MB)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                   ) : (
                    <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-[#FFC000] shadow-[0_0_15px_rgba(255,192,0,0.1)]">
                        <img src={newImage} alt="New Verification" className="w-full h-full object-cover" />
                        <button 
                        onClick={removeNewImage}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                        >
                        <X size={20} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-[#FFC000] p-2 text-center">
                            <p className="text-black font-bold text-xs uppercase tracking-wider">New Image Ready to Upload</p>
                        </div>
                    </div>
                   )}
                   {error && (
                     <div className="mt-3 flex items-center gap-2 text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                        <AlertCircle size={16} /> {error}
                     </div>
                   )}
                </div>
            ) : (
                // State where user cannot add image (e.g. not neighbor method AND image already exists)
                 !shipment.verification.image && (
                    <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 text-center text-gray-400 text-sm">
                        Verification image not required for this delivery method.
                    </div>
                 )
            )}

            {/* Actions */}
            <div className="mt-8 pt-6 border-t border-[#333333] flex justify-end">
                <button 
                    onClick={handleSave}
                    disabled={!newImage}
                    className={`px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${
                        newImage 
                        ? 'bg-[#FFC000] text-black hover:bg-[#E5AC00] hover:-translate-y-0.5 shadow-[#FFC000]/20' 
                        : 'bg-[#333333] text-gray-500 cursor-not-allowed'
                    }`}
                >
                    <Save size={20} /> Save Changes
                </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default EditShipment;