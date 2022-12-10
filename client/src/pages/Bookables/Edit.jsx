import { useState, useEffect, useContext } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useQueryClient, useMutation, useQuery } from "react-query";
import { useSelector } from "react-redux";

import bookableFormState from "../../Helpers/FormState/bookable.jsx";
import getData, { editItem, deleteItem } from "../../utils/api";

import BookableForm from "../../components/Bookables/Form.jsx";
import PageSpinner from "../../components/Spinner";

export default function BookableEdit() {
  const [roleAdmin, setRoleAdmin] = useState(false);
  const [check, setCheck] = useState(false);

  const { user: currentUser } = useSelector((state) => state.auth);

  const { id } = useParams();
  const { data, isLoading } = useBookable(id);
  const formState = bookableFormState(data);

  useEffect(() => {
    if (currentUser) {
      currentUser.roles.map((role) => {
        // if (role === "ROLE_ADMIN") console.log("setRoleAdmin(true);");/
        setRoleAdmin(true);
        setCheck(true);
      });
    }
  }, []);

  // get the mutation function and status booleans
  // for updating the bookable
  const { updateBookable, isUpdating, isUpdateError, updateError } = useUpdateBookable();

  // get the mutation function and status booleans
  // for deleting the bookable
  const { deleteBookable, isDeleting, isDeleteError, deleteError } = useDeleteBookable();

  function handleDelete() {
    if (window.confirm("Are you sure you want to delete the bookable?")) {
      // call the mutation function for deleting the bookable
      deleteBookable(formState.state);
    }
  }

  function handleSubmit() {
    // call the mutation function for updating the bookable
    updateBookable(formState.state);
    // console.log("Check formState.state: ", formState.state);
  }

  if (isUpdateError || isDeleteError) {
    return <p>{updateError?.message || deleteError.message}</p>;
  }

  if (isLoading || isUpdating || isDeleting) {
    return <PageSpinner />;
  }

  if (!currentUser && !check) {
    return <Navigate to="/error" />;
  }

  if (!currentUser && check) {
    return <Navigate to="/" />;
  }

  if (!roleAdmin && check) {
    return <Navigate to="/error" />;
  }

  return (
    <BookableForm formState={formState} handleSubmit={handleSubmit} handleDelete={handleDelete} roleAdmin={roleAdmin} />
  );
}

function useBookable(id) {
  const queryClient = useQueryClient();
  return useQuery(["bookable", id], () => getData(`http://localhost:8080/bookables/${id}`), {
    // refetching causes problems after deleting a bookable
    refetchOnWindowFocus: false,

    initialData: queryClient.getQueryData("bookables")?.find((b) => b.id === parseInt(id, 10)),
  });
}

function useUpdateBookable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation((item) => editItem(`http://localhost:8080/bookables/${item.id}`, item), {
    onSuccess: (bookable) => {
      // replace the pre-edited version in the "bookables" cache
      // with the edited bookable
      updateBookablesCache(bookable, queryClient);

      // do the same for the individual "bookable" cache
      queryClient.setQueryData(["bookable", String(bookable.id)], bookable);

      // show the updated bookable
      navigate(`/bookables/${bookable.id}`);
    },
  });

  return {
    updateBookable: mutation.mutate,
    isUpdating: mutation.isLoading,
    isUpdateError: mutation.isError,
    updateError: mutation.error,
  };
}

/* Replace a bookable in the cache
 * with the updated version.
 */
function updateBookablesCache(bookable, queryClient) {
  // get all the bookables from the cache
  const bookables = queryClient.getQueryData("bookables") || [];

  // find the index in the cache of the bookable that's been edited
  const bookableIndex = bookables.findIndex((b) => b.id === bookable.id);

  // if found, replace the pre-edited version with the edited one
  if (bookableIndex !== -1) {
    bookables[bookableIndex] = bookable;
    queryClient.setQueryData("bookables", bookables);
  }
}

function useDeleteBookable() {
  const navigate = useNavigate();
  // const queryClient = useQueryClient();
  const mutation = useMutation((bookable) => deleteItem(`http://localhost:8080/bookables/${bookable.id}`), {
    /* on success receives the original item as a second argument */
    onSuccess: (response, bookable) => {
      // get all the bookables from the cache
      // const bookables = queryClient.getQueryData("bookables") || [];

      // // set the bookables cache without the deleted one
      // queryClient.setQueryData(
      //   "bookables",
      //   bookables.filter((b) => b.id !== bookable.id)
      // );

      // If there are other bookables in the same group as the deleted one,
      // navigate to the first
      // navigate(`/bookables/${getIdForFirstInGroup(bookables, bookable) || ""}`);
      navigate("/");
    },
  });

  return {
    deleteBookable: mutation.mutate,
    isDeleting: mutation.isLoading,
    isDeleteError: mutation.isError,
    deleteError: mutation.error,
  };
}

function getIdForFirstInGroup(bookables, excludedBookable) {
  // get the id and group of the deleted bookable
  const { id, group } = excludedBookable;

  // find the first other bookable in the same group as the deleted one
  const bookableInGroup = bookables.find((b) => b.group === group && b.id !== id);

  // return its id or undefined
  return bookableInGroup?.id;
}
